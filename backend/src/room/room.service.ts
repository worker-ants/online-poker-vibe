import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Room } from './room.entity.js';
import { RoomPlayer } from './room-player.entity.js';
import { PlayerService } from '../player/player.service.js';
import type { RoomSettings } from '../common/types/index.js';
import type { CreateRoomDto } from './create-room.dto.js';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    private readonly playerService: PlayerService,
  ) {}

  async createRoom(playerUuid: string, dto: CreateRoomDto): Promise<Room> {
    const player = await this.playerService.findByUuid(playerUuid);
    if (!player || !player.nickname) {
      throw new BadRequestException('닉네임을 먼저 설정해주세요.');
    }

    // Check if player is already in a room
    const existingRoom = await this.findPlayerCurrentRoom(playerUuid);
    if (existingRoom) {
      throw new BadRequestException('이미 다른 방에 참여 중입니다.');
    }

    const maxPlayers = dto.maxPlayers ?? 6;
    if (maxPlayers < 2 || maxPlayers > 6) {
      throw new BadRequestException('최대 인원은 2~6명이어야 합니다.');
    }

    const defaultSettings: RoomSettings = {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      ...(dto.settings ?? {}),
    };

    const room = this.roomRepository.create({
      id: uuidv4(),
      name: dto.name,
      variant: dto.variant,
      mode: dto.mode,
      status: 'waiting',
      hostUuid: playerUuid,
      maxPlayers,
      settings: JSON.stringify(defaultSettings),
    });

    // Host auto-joins at seat 0
    const roomPlayer = this.roomPlayerRepository.create({
      roomId: room.id,
      playerUuid,
      seatIndex: 0,
      isReady: false,
    });

    const queryRunner =
      this.roomRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.save(room);
      await queryRunner.manager.save(roomPlayer);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return room;
  }

  async getWaitingRooms(): Promise<any[]> {
    const rooms = await this.roomRepository.find({
      where: { status: 'waiting' },
      relations: ['host', 'roomPlayers'],
      order: { createdAt: 'DESC' },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      variant: room.variant,
      mode: room.mode,
      status: room.status,
      playerCount: room.roomPlayers?.length ?? 0,
      maxPlayers: room.maxPlayers,
      hostNickname: room.host?.nickname ?? 'Unknown',
      createdAt: room.createdAt,
    }));
  }

  async joinRoom(roomId: string, playerUuid: string): Promise<RoomPlayer> {
    const player = await this.playerService.findByUuid(playerUuid);
    if (!player || !player.nickname) {
      throw new BadRequestException('닉네임을 먼저 설정해주세요.');
    }

    const existingRoom = await this.findPlayerCurrentRoom(playerUuid);
    if (existingRoom) {
      if (existingRoom.roomId === roomId) {
        // Already in this room, return existing
        return existingRoom;
      }
      throw new BadRequestException('이미 다른 방에 참여 중입니다.');
    }

    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['roomPlayers'],
    });

    if (!room) {
      throw new BadRequestException('존재하지 않는 방입니다.');
    }

    if (room.status !== 'waiting') {
      throw new BadRequestException('이미 게임이 시작된 방입니다.');
    }

    if (room.roomPlayers.length >= room.maxPlayers) {
      throw new BadRequestException('방이 가득 찼습니다.');
    }

    // Find available seat
    const occupiedSeats = new Set(room.roomPlayers.map((rp) => rp.seatIndex));
    let seatIndex = 0;
    while (occupiedSeats.has(seatIndex)) {
      seatIndex++;
    }

    const roomPlayer = this.roomPlayerRepository.create({
      roomId,
      playerUuid,
      seatIndex,
      isReady: false,
    });

    try {
      return await this.roomPlayerRepository.save(roomPlayer);
    } catch (error: unknown) {
      const err = error as { code?: string; name?: string };
      if (err.code === 'SQLITE_CONSTRAINT' || err.name === 'QueryFailedError') {
        throw new BadRequestException(
          '좌석 배정에 실패했습니다. 다시 시도해주세요.',
        );
      }
      throw error;
    }
  }

  async leaveRoom(roomId: string, playerUuid: string): Promise<void> {
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerUuid },
    });

    if (!roomPlayer) return;

    await this.roomPlayerRepository.remove(roomPlayer);

    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['roomPlayers'],
    });

    if (!room) return;

    // If no players left, delete room
    if (room.roomPlayers.length === 0) {
      await this.roomRepository.remove(room);
      return;
    }

    // If host left, transfer to next player
    if (room.hostUuid === playerUuid) {
      const nextHost = room.roomPlayers.sort(
        (a, b) => a.seatIndex - b.seatIndex,
      )[0];
      room.hostUuid = nextHost.playerUuid;
      await this.roomRepository.save(room);
    }
  }

  async toggleReady(roomId: string, playerUuid: string): Promise<boolean> {
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, playerUuid },
    });

    if (!roomPlayer) {
      throw new BadRequestException('방에 참여하지 않았습니다.');
    }

    roomPlayer.isReady = !roomPlayer.isReady;
    await this.roomPlayerRepository.save(roomPlayer);
    return roomPlayer.isReady;
  }

  async kickPlayer(
    roomId: string,
    hostUuid: string,
    targetUuid: string,
  ): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new BadRequestException('존재하지 않는 방입니다.');
    }

    if (room.hostUuid !== hostUuid) {
      throw new BadRequestException('방장만 추방할 수 있습니다.');
    }

    if (room.status !== 'waiting') {
      throw new BadRequestException('게임 시작 전에만 추방할 수 있습니다.');
    }

    if (hostUuid === targetUuid) {
      throw new BadRequestException('자기 자신은 추방할 수 없습니다.');
    }

    const target = await this.roomPlayerRepository.findOne({
      where: { roomId, playerUuid: targetUuid },
    });

    if (!target) {
      throw new BadRequestException('해당 플레이어가 방에 없습니다.');
    }

    await this.roomPlayerRepository.remove(target);
  }

  async getRoomState(roomId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['roomPlayers', 'roomPlayers.player'],
    });

    if (!room) return null;

    return {
      roomId: room.id,
      name: room.name,
      variant: room.variant,
      mode: room.mode,
      status: room.status,
      hostUuid: room.hostUuid,
      maxPlayers: room.maxPlayers,
      settings: room.getSettings(),
      players: room.roomPlayers.map((rp) => ({
        uuid: rp.playerUuid,
        nickname: rp.player?.nickname ?? 'Unknown',
        seatIndex: rp.seatIndex,
        isReady: rp.isReady,
        isHost: rp.playerUuid === room.hostUuid,
      })),
    };
  }

  async checkAllReady(roomId: string): Promise<boolean> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['roomPlayers'],
    });

    // 1명이라도 준비되면 AI가 나머지 좌석을 채움
    if (!room || room.roomPlayers.length < 1) return false;
    return room.roomPlayers.every((rp) => rp.isReady);
  }

  async setRoomStatus(
    roomId: string,
    status: 'waiting' | 'playing' | 'finished',
  ): Promise<void> {
    await this.roomRepository.update(roomId, { status });
  }

  async findPlayerCurrentRoom(playerUuid: string): Promise<RoomPlayer | null> {
    return this.roomPlayerRepository.findOne({
      where: { playerUuid },
      relations: ['room'],
    });
  }

  async getRoomPlayers(roomId: string): Promise<RoomPlayer[]> {
    return this.roomPlayerRepository.find({
      where: { roomId },
      relations: ['player'],
      order: { seatIndex: 'ASC' },
    });
  }

  async findRoomById(roomId: string): Promise<Room | null> {
    return this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['roomPlayers', 'roomPlayers.player'],
    });
  }
}
