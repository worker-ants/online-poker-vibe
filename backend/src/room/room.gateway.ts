import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as cookie from 'cookie-parser';
import { WS_EVENTS } from '../common/types/events.types.js';
import { RoomService } from './room.service.js';
import { PlayerService } from '../player/player.service.js';
import { GameService } from '../game/game.service.js';

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...val] = pair.split('=');
    cookies[key.trim()] = decodeURIComponent(val.join('=').trim());
  });
  return cookies;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map socket.id -> playerUuid
  private socketPlayerMap = new Map<string, string>();
  // Map playerUuid -> socket.id
  private playerSocketMap = new Map<string, string>();

  constructor(
    private readonly roomService: RoomService,
    private readonly playerService: PlayerService,
    private readonly gameService: GameService,
  ) {}

  async handleConnection(client: Socket) {
    const cookieHeader = client.handshake.headers.cookie ?? '';
    const cookies = parseCookies(cookieHeader);
    const uuid = cookies['player_uuid'];

    if (!uuid) {
      client.emit(WS_EVENTS.ERROR, {
        code: 'NO_AUTH',
        message: '인증 쿠키가 없습니다.',
      });
      client.disconnect();
      return;
    }

    const player = await this.playerService.findOrCreate(uuid);
    this.socketPlayerMap.set(client.id, uuid);
    this.playerSocketMap.set(uuid, client.id);

    client.emit(WS_EVENTS.IDENTITY_CONFIRMED, {
      playerId: player.uuid,
      nickname: player.nickname,
    });
  }

  handleDisconnect(client: Socket) {
    const uuid = this.socketPlayerMap.get(client.id);
    if (uuid) {
      this.socketPlayerMap.delete(client.id);
      this.playerSocketMap.delete(uuid);
    }
  }

  getPlayerUuid(client: Socket): string | undefined {
    return this.socketPlayerMap.get(client.id);
  }

  getPlayerSocket(playerUuid: string): string | undefined {
    return this.playerSocketMap.get(playerUuid);
  }

  @SubscribeMessage(WS_EVENTS.IDENTITY_SET_NICKNAME)
  async handleSetNickname(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { nickname: string },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      const player = await this.playerService.setNickname(uuid, data.nickname);
      return { success: true, nickname: player.nickname };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage(WS_EVENTS.ROOM_LIST)
  async handleRoomList() {
    return this.roomService.getWaitingRooms();
  }

  @SubscribeMessage(WS_EVENTS.ROOM_CREATE)
  async handleRoomCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      const room = await this.roomService.createRoom(uuid, data);
      client.join(room.id);

      // Broadcast updated room list
      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true, roomId: room.id };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage(WS_EVENTS.ROOM_JOIN)
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      await this.roomService.joinRoom(data.roomId, uuid);
      client.join(data.roomId);

      const roomState = await this.roomService.getRoomState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);

      // Broadcast updated room list
      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true, room: roomState };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage(WS_EVENTS.ROOM_LEAVE)
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return;

    await this.roomService.leaveRoom(data.roomId, uuid);
    client.leave(data.roomId);

    const roomState = await this.roomService.getRoomState(data.roomId);
    if (roomState) {
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);
    }

    const rooms = await this.roomService.getWaitingRooms();
    this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);
  }

  @SubscribeMessage(WS_EVENTS.ROOM_READY)
  async handleRoomReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      await this.roomService.toggleReady(data.roomId, uuid);
      const roomState = await this.roomService.getRoomState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);

      // Check if all ready and can start game
      const allReady = await this.roomService.checkAllReady(data.roomId);
      if (allReady) {
        await this.startGame(data.roomId);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage(WS_EVENTS.ROOM_KICK)
  async handleRoomKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetUuid: string },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      await this.roomService.kickPlayer(data.roomId, uuid, data.targetUuid);

      // Notify kicked player
      const targetSocketId = this.getPlayerSocket(data.targetUuid);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit(WS_EVENTS.ROOM_KICKED, {
          roomId: data.roomId,
          reason: '방장에 의해 추방되었습니다.',
        });
        // Remove from Socket.IO room
        const targetSocket = this.server.sockets.sockets.get(targetSocketId);
        targetSocket?.leave(data.roomId);
      }

      const roomState = await this.roomService.getRoomState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);

      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage(WS_EVENTS.GAME_ACTION)
  async handleGameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      action: string;
      amount?: number;
      discardIndices?: number[];
    },
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      const result = await this.gameService.handleAction(data.roomId, uuid, {
        type: data.action as any,
        amount: data.amount,
        discardIndices: data.discardIndices,
      });

      // Broadcast public state
      const publicState = this.gameService.getPublicState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.GAME_STATE, publicState);

      // Broadcast action performed
      this.server.to(data.roomId).emit(WS_EVENTS.GAME_ACTION_PERFORMED, {
        playerUuid: uuid,
        action: data.action,
        amount: data.amount,
      });

      // Send private cards to each player
      await this.sendPrivateStates(data.roomId);

      // Check if hand is complete
      if (result.handComplete) {
        this.server
          .to(data.roomId)
          .emit(WS_EVENTS.GAME_SHOWDOWN, result.showdown);

        if (result.gameOver) {
          this.server
            .to(data.roomId)
            .emit(WS_EVENTS.GAME_ENDED, result.gameResult);
          await this.roomService.setRoomStatus(data.roomId, 'finished');
        } else {
          // Start next hand after a delay
          setTimeout(() => this.startNextHand(data.roomId), 3000);
        }
      } else {
        // Notify next player
        const actionRequired = this.gameService.getActionRequired(data.roomId);
        if (actionRequired) {
          const nextSocketId = this.getPlayerSocket(actionRequired.playerUuid);
          if (nextSocketId) {
            this.server
              .to(nextSocketId)
              .emit(WS_EVENTS.GAME_ACTION_REQUIRED, actionRequired);
          }
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  private async startGame(roomId: string) {
    await this.roomService.setRoomStatus(roomId, 'playing');

    const room = await this.roomService.findRoomById(roomId);
    if (!room) return;

    const gameId = await this.gameService.startGame(room);

    this.server.to(roomId).emit(WS_EVENTS.GAME_STARTED, {
      roomId,
      gameId,
      variant: room.variant,
      mode: room.mode,
    });

    // Send initial public state
    const publicState = this.gameService.getPublicState(roomId);
    this.server.to(roomId).emit(WS_EVENTS.GAME_STATE, publicState);

    // Send private cards to each player
    await this.sendPrivateStates(roomId);

    // Notify first player of their turn
    const actionRequired = this.gameService.getActionRequired(roomId);
    if (actionRequired) {
      const socketId = this.getPlayerSocket(actionRequired.playerUuid);
      if (socketId) {
        this.server
          .to(socketId)
          .emit(WS_EVENTS.GAME_ACTION_REQUIRED, actionRequired);
      }
    }

    // Broadcast updated room list (room is now playing)
    const rooms = await this.roomService.getWaitingRooms();
    this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);
  }

  private async startNextHand(roomId: string) {
    try {
      this.gameService.startNextHand(roomId);

      const publicState = this.gameService.getPublicState(roomId);
      this.server.to(roomId).emit(WS_EVENTS.GAME_STATE, publicState);

      await this.sendPrivateStates(roomId);

      const actionRequired = this.gameService.getActionRequired(roomId);
      if (actionRequired) {
        const socketId = this.getPlayerSocket(actionRequired.playerUuid);
        if (socketId) {
          this.server
            .to(socketId)
            .emit(WS_EVENTS.GAME_ACTION_REQUIRED, actionRequired);
        }
      }
    } catch {
      // Game may have ended
    }
  }

  private async sendPrivateStates(roomId: string) {
    const privateStates = this.gameService.getPrivateStates(roomId);
    if (!privateStates) return;

    for (const [playerUuid, holeCards] of Object.entries(privateStates)) {
      const socketId = this.getPlayerSocket(playerUuid);
      if (socketId) {
        this.server.to(socketId).emit(WS_EVENTS.GAME_PRIVATE, { holeCards });
      }
    }
  }
}
