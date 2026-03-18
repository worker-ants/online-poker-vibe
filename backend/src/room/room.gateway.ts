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
import { WS_EVENTS } from '../common/types/events.types.js';
import { RoomService } from './room.service.js';
import { PlayerService } from '../player/player.service.js';
import { GameService } from '../game/game.service.js';
import { AiPlayerService } from '../ai/ai-player.service.js';
import { isAiPlayer } from '../ai/ai-names.js';
import type { CreateRoomDto } from './create-room.dto.js';
import type {
  PlayerSeat,
  BettingAction,
  PlayerAction,
} from '../common/types/game.types.js';

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...val] = pair.split('=');
    cookies[key.trim()] = decodeURIComponent(val.join('=').trim());
  });
  return cookies;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
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

  // Map roomId -> AI PlayerSeat[]
  private aiPlayersMap = new Map<string, PlayerSeat[]>();

  constructor(
    private readonly roomService: RoomService,
    private readonly playerService: PlayerService,
    private readonly gameService: GameService,
    private readonly aiPlayerService: AiPlayerService,
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
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
    }
  }

  @SubscribeMessage(WS_EVENTS.ROOM_LIST)
  async handleRoomList() {
    return this.roomService.getWaitingRooms();
  }

  @SubscribeMessage(WS_EVENTS.ROOM_CREATE)
  async handleRoomCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateRoomDto,
  ) {
    const uuid = this.getPlayerUuid(client);
    if (!uuid) return { success: false, error: '인증이 필요합니다.' };

    try {
      const room = await this.roomService.createRoom(uuid, data);
      void client.join(room.id);

      // Broadcast updated room list
      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true, roomId: room.id };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
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
      void client.join(data.roomId);

      const roomState = await this.roomService.getRoomState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);

      // Broadcast updated room list
      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true, room: roomState };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
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
    void client.leave(data.roomId);

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
        // Create AI players to fill empty seats
        const room = await this.roomService.findRoomById(data.roomId);
        if (room) {
          const humanCount = room.roomPlayers.length;
          const aiCount = room.maxPlayers - humanCount;
          if (aiCount > 0) {
            const occupiedSeats = new Set(
              room.roomPlayers.map((rp) => rp.seatIndex),
            );
            const aiPlayers = this.aiPlayerService.createAiPlayers(
              aiCount,
              occupiedSeats,
            );
            this.aiPlayersMap.set(data.roomId, aiPlayers);
          }
        }
        await this.startGame(data.roomId);
      }

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
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
        void targetSocket?.leave(data.roomId);
      }

      const roomState = await this.roomService.getRoomState(data.roomId);
      this.server.to(data.roomId).emit(WS_EVENTS.ROOM_UPDATED, roomState);

      const rooms = await this.roomService.getWaitingRooms();
      this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
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
      const playerAction: PlayerAction = {
        type: data.action as BettingAction | 'draw',
        amount: data.amount,
        discardIndices: data.discardIndices,
      };
      const result = await this.gameService.handleAction(
        data.roomId,
        uuid,
        playerAction,
      );

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
      this.sendPrivateStates(data.roomId);

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
          this.aiPlayersMap.delete(data.roomId);
        } else {
          // Start next hand after a delay
          setTimeout(() => void this.startNextHand(data.roomId), 3000);
        }
      } else {
        // Process AI turns or notify human player
        await this.processAiTurnsOrNotify(data.roomId);
      }

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: getErrorMessage(e) };
    }
  }

  private async startGame(roomId: string) {
    await this.roomService.setRoomStatus(roomId, 'playing');

    const room = await this.roomService.findRoomById(roomId);
    if (!room) return;

    const aiPlayers = this.aiPlayersMap.get(roomId) ?? [];
    const gameId = await this.gameService.startGame(room, aiPlayers);

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
    this.sendPrivateStates(roomId);

    // Broadcast updated room list (room is now playing)
    const rooms = await this.roomService.getWaitingRooms();
    this.server.emit(WS_EVENTS.ROOM_LIST_UPDATE, rooms);

    // Process AI turns or notify human player
    await this.processAiTurnsOrNotify(roomId);
  }

  private async startNextHand(roomId: string) {
    try {
      this.gameService.startNextHand(roomId);

      const publicState = this.gameService.getPublicState(roomId);
      this.server.to(roomId).emit(WS_EVENTS.GAME_STATE, publicState);

      this.sendPrivateStates(roomId);

      // Process AI turns or notify human player
      await this.processAiTurnsOrNotify(roomId);
    } catch {
      // Game may have ended
    }
  }

  // Guard to prevent concurrent AI loop execution per room
  private processingAiTurns = new Set<string>();

  private async processAiTurnsOrNotify(roomId: string) {
    if (this.processingAiTurns.has(roomId)) return;
    this.processingAiTurns.add(roomId);

    const MAX_AI_TURNS = 100;
    let turnCount = 0;

    try {
      // Runs until human player's turn, hand ends, or max iterations reached
      while (turnCount < MAX_AI_TURNS) {
        turnCount++;
        const actionRequired = this.gameService.getActionRequired(roomId);
        if (!actionRequired) break;

        // If not an AI player, notify human and stop
        if (!isAiPlayer(actionRequired.playerUuid)) {
          const socketId = this.getPlayerSocket(actionRequired.playerUuid);
          if (socketId) {
            this.server
              .to(socketId)
              .emit(WS_EVENTS.GAME_ACTION_REQUIRED, actionRequired);
          }
          break;
        }

        // AI player's turn - decide and act immediately
        const gameState = this.gameService.getGameState(roomId);
        if (!gameState) break;

        let aiAction: PlayerAction;
        if (actionRequired.isDraw) {
          // Five Card Draw draw phase
          const player = gameState.players.find(
            (p) => p.uuid === actionRequired.playerUuid,
          );
          const discardIndices = player
            ? this.aiPlayerService.getDiscardIndices(player.holeCards)
            : [];
          aiAction = { type: 'draw' as const, discardIndices };
        } else {
          aiAction = this.aiPlayerService.decideAction(
            gameState,
            actionRequired.playerUuid,
            {
              actions: actionRequired.validActions,
              callAmount: actionRequired.callAmount,
              minRaise: actionRequired.minRaise,
              maxRaise: actionRequired.maxRaise,
            },
            gameState.variant,
          );
        }

        const result = await this.gameService.handleAction(
          roomId,
          actionRequired.playerUuid,
          aiAction,
          true, // fromAiLoop
        );

        // Broadcast AI action
        const updatedState = this.gameService.getPublicState(roomId);
        this.server.to(roomId).emit(WS_EVENTS.GAME_STATE, updatedState);
        this.server.to(roomId).emit(WS_EVENTS.GAME_ACTION_PERFORMED, {
          playerUuid: actionRequired.playerUuid,
          action: aiAction.type,
          amount: aiAction.amount,
        });
        this.sendPrivateStates(roomId);

        if (result.handComplete) {
          this.server.to(roomId).emit(WS_EVENTS.GAME_SHOWDOWN, result.showdown);

          if (result.gameOver) {
            this.server
              .to(roomId)
              .emit(WS_EVENTS.GAME_ENDED, result.gameResult);
            await this.roomService.setRoomStatus(roomId, 'finished');
            this.aiPlayersMap.delete(roomId);
          } else {
            setTimeout(() => void this.startNextHand(roomId), 3000);
          }
          break;
        }
      }
    } catch {
      this.server.to(roomId).emit(WS_EVENTS.ERROR, {
        code: 'AI_ERROR',
        message: 'AI 플레이어 처리 중 오류가 발생했습니다.',
      });
    } finally {
      this.processingAiTurns.delete(roomId);
    }
  }

  private sendPrivateStates(roomId: string) {
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
