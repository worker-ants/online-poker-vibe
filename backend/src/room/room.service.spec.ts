import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { RoomService } from './room.service.js';
import { Room } from './room.entity.js';
import { RoomPlayer } from './room-player.entity.js';
import { PlayerService } from '../player/player.service.js';

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  },
};

const mockRoomRepository = {
  create: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  update: jest.fn(() => Promise.resolve()),
  find: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(),
  remove: jest.fn((entity: unknown) => Promise.resolve(entity)),
  manager: {
    connection: {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    },
  },
};

const mockRoomPlayerRepository = {
  create: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  find: jest.fn(() => Promise.resolve([])),
  findOne: jest.fn(),
  remove: jest.fn((entity: unknown) => Promise.resolve(entity)),
};

const mockPlayerService = {
  findByUuid: jest.fn(),
};

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRoomRepository,
        },
        {
          provide: getRepositoryToken(RoomPlayer),
          useValue: mockRoomPlayerRepository,
        },
        {
          provide: PlayerService,
          useValue: mockPlayerService,
        },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
  });

  const validDto = {
    name: 'Test Room',
    variant: 'texas-holdem' as const,
    mode: 'cash' as const,
    maxPlayers: 6,
  };

  describe('createRoom', () => {
    it('should throw when player has no nickname', async () => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p1',
        nickname: null,
      });

      await expect(service.createRoom('p1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when player does not exist', async () => {
      mockPlayerService.findByUuid.mockResolvedValue(null);

      await expect(service.createRoom('p1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when player is already in a room', async () => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p1',
        nickname: 'Player1',
      });
      mockRoomPlayerRepository.findOne.mockResolvedValue({
        roomId: 'other-room',
        playerUuid: 'p1',
      });

      await expect(service.createRoom('p1', validDto)).rejects.toThrow(
        '이미 다른 방에 참여 중입니다.',
      );
    });

    it('should throw for invalid maxPlayers (too small)', async () => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p1',
        nickname: 'Player1',
      });
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRoom('p1', { ...validDto, maxPlayers: 1 }),
      ).rejects.toThrow('최대 인원은 2~6명이어야 합니다.');
    });

    it('should throw for invalid maxPlayers (too large)', async () => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p1',
        nickname: 'Player1',
      });
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createRoom('p1', { ...validDto, maxPlayers: 7 }),
      ).rejects.toThrow('최대 인원은 2~6명이어야 합니다.');
    });

    it('should succeed and use transaction', async () => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p1',
        nickname: 'Player1',
      });
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      const result = await service.createRoom('p1', validDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Room');
      expect(result.hostUuid).toBe('p1');
      expect(result.status).toBe('waiting');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2); // room + roomPlayer
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('joinRoom', () => {
    beforeEach(() => {
      mockPlayerService.findByUuid.mockResolvedValue({
        uuid: 'p2',
        nickname: 'Player2',
      });
    });

    it('should throw when room does not exist', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null); // not in any room
      mockRoomRepository.findOne.mockResolvedValue(null);

      await expect(service.joinRoom('room-x', 'p2')).rejects.toThrow(
        '존재하지 않는 방입니다.',
      );
    });

    it('should throw when room is not waiting', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        status: 'playing',
        roomPlayers: [],
        maxPlayers: 6,
      });

      await expect(service.joinRoom('room-1', 'p2')).rejects.toThrow(
        '이미 게임이 시작된 방입니다.',
      );
    });

    it('should throw when room is full', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        status: 'waiting',
        roomPlayers: [
          { playerUuid: 'p1', seatIndex: 0 },
          { playerUuid: 'p3', seatIndex: 1 },
        ],
        maxPlayers: 2,
      });

      await expect(service.joinRoom('room-1', 'p2')).rejects.toThrow(
        '방이 가득 찼습니다.',
      );
    });

    it('should return existing if already in this room', async () => {
      const existingRoomPlayer = {
        roomId: 'room-1',
        playerUuid: 'p2',
        seatIndex: 1,
      };
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingRoomPlayer);

      const result = await service.joinRoom('room-1', 'p2');
      expect(result).toBe(existingRoomPlayer);
    });

    it('should throw when already in another room', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue({
        roomId: 'other-room',
        playerUuid: 'p2',
      });

      await expect(service.joinRoom('room-1', 'p2')).rejects.toThrow(
        '이미 다른 방에 참여 중입니다.',
      );
    });

    it('should join successfully and assign correct seat', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        status: 'waiting',
        roomPlayers: [{ playerUuid: 'p1', seatIndex: 0 }],
        maxPlayers: 6,
      });

      await service.joinRoom('room-1', 'p2');

      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-1',
          playerUuid: 'p2',
          seatIndex: 1,
          isReady: false,
        }),
      );
      expect(mockRoomPlayerRepository.save).toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('should do nothing when player is not in room', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await service.leaveRoom('room-1', 'p1');

      expect(mockRoomPlayerRepository.remove).not.toHaveBeenCalled();
    });

    it('should delete room when last player leaves', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue({
        roomId: 'room-1',
        playerUuid: 'p1',
      });
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        hostUuid: 'p1',
        roomPlayers: [],
      });

      await service.leaveRoom('room-1', 'p1');

      expect(mockRoomPlayerRepository.remove).toHaveBeenCalled();
      expect(mockRoomRepository.remove).toHaveBeenCalled();
    });

    it('should transfer host when host leaves', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue({
        roomId: 'room-1',
        playerUuid: 'p1',
      });
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        hostUuid: 'p1',
        roomPlayers: [
          { playerUuid: 'p2', seatIndex: 1 },
          { playerUuid: 'p3', seatIndex: 2 },
        ],
      });

      await service.leaveRoom('room-1', 'p1');

      expect(mockRoomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ hostUuid: 'p2' }),
      );
    });
  });

  describe('toggleReady', () => {
    it('should throw when player is not in room', async () => {
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.toggleReady('room-1', 'p1')).rejects.toThrow(
        '방에 참여하지 않았습니다.',
      );
    });

    it('should flip ready state from false to true', async () => {
      const roomPlayer = {
        roomId: 'room-1',
        playerUuid: 'p1',
        isReady: false,
      };
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);

      const result = await service.toggleReady('room-1', 'p1');

      expect(result).toBe(true);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isReady: true }),
      );
    });

    it('should flip ready state from true to false', async () => {
      const roomPlayer = {
        roomId: 'room-1',
        playerUuid: 'p1',
        isReady: true,
      };
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);

      const result = await service.toggleReady('room-1', 'p1');

      expect(result).toBe(false);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isReady: false }),
      );
    });
  });

  describe('kickPlayer', () => {
    it('should throw when not host', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        hostUuid: 'p1',
        status: 'waiting',
      });

      await expect(service.kickPlayer('room-1', 'p2', 'p3')).rejects.toThrow(
        '방장만 추방할 수 있습니다.',
      );
    });

    it('should throw when trying to kick self', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        hostUuid: 'p1',
        status: 'waiting',
      });

      await expect(service.kickPlayer('room-1', 'p1', 'p1')).rejects.toThrow(
        '자기 자신은 추방할 수 없습니다.',
      );
    });

    it('should throw when room does not exist', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      await expect(service.kickPlayer('room-x', 'p1', 'p2')).rejects.toThrow(
        '존재하지 않는 방입니다.',
      );
    });

    it('should successfully kick a player', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        hostUuid: 'p1',
        status: 'waiting',
      });
      const target = { roomId: 'room-1', playerUuid: 'p2' };
      mockRoomPlayerRepository.findOne.mockResolvedValue(target);

      await service.kickPlayer('room-1', 'p1', 'p2');

      expect(mockRoomPlayerRepository.remove).toHaveBeenCalledWith(target);
    });
  });

  describe('checkAllReady', () => {
    it('should return true when 1 player is ready (AI will fill remaining)', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        roomPlayers: [{ playerUuid: 'p1', isReady: true }],
      });

      const result = await service.checkAllReady('room-1');
      expect(result).toBe(true);
    });

    it('should return false when no players', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        roomPlayers: [],
      });

      const result = await service.checkAllReady('room-1');
      expect(result).toBe(false);
    });

    it('should return false when room does not exist', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      const result = await service.checkAllReady('room-x');
      expect(result).toBe(false);
    });

    it('should return false when not all players are ready', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        roomPlayers: [
          { playerUuid: 'p1', isReady: true },
          { playerUuid: 'p2', isReady: false },
        ],
      });

      const result = await service.checkAllReady('room-1');
      expect(result).toBe(false);
    });

    it('should return true when all players are ready', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 'room-1',
        roomPlayers: [
          { playerUuid: 'p1', isReady: true },
          { playerUuid: 'p2', isReady: true },
        ],
      });

      const result = await service.checkAllReady('room-1');
      expect(result).toBe(true);
    });
  });

  describe('setRoomStatus', () => {
    it('should call update with the correct status', async () => {
      await service.setRoomStatus('room-1', 'playing');

      expect(mockRoomRepository.update).toHaveBeenCalledWith('room-1', {
        status: 'playing',
      });
    });
  });
});
