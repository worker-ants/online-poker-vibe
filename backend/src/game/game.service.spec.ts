import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GameService } from './game.service.js';
import { Game } from './game.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import type { Room } from '../room/room.entity.js';

function makeRoom(): Partial<Room> {
  return {
    id: 'room-1',
    variant: 'texas-holdem',
    mode: 'cash',
    getSettings: () => ({ startingChips: 1000, smallBlind: 10, bigBlind: 20 }),
    roomPlayers: [
      {
        playerUuid: 'p1',
        seatIndex: 0,
        player: { nickname: 'Player1' },
      } as any,
      {
        playerUuid: 'p2',
        seatIndex: 1,
        player: { nickname: 'Player2' },
      } as any,
    ],
  };
}

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    update: jest.fn(),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  },
};

const mockDeleteQueryBuilder = {
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

const mockQueryRunnerForDelete = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    update: jest.fn(),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => mockDeleteQueryBuilder),
  },
};

const mockGameRepository = {
  create: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  update: jest.fn(() => Promise.resolve()),
  find: jest.fn(),
  findOne: jest.fn(() => Promise.resolve(null)),
  manager: {
    connection: {
      createQueryRunner: jest.fn(() => mockQueryRunner),
    },
  },
};

const mockParticipantRepository = {
  create: jest.fn((entity: unknown) => entity),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  find: jest.fn(() => Promise.resolve([])),
};

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: getRepositoryToken(Game),
          useValue: mockGameRepository,
        },
        {
          provide: getRepositoryToken(GameParticipant),
          useValue: mockParticipantRepository,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  describe('onModuleInit', () => {
    it('should mark in-progress games as abandoned', async () => {
      await service.onModuleInit();

      expect(mockGameRepository.update).toHaveBeenCalledWith(
        { status: 'in-progress' },
        expect.objectContaining({ status: 'abandoned' }),
      );
    });
  });

  describe('startGame', () => {
    it('should save game to DB and return gameId', async () => {
      const room = makeRoom() as Room;
      const gameId = await service.startGame(room);

      expect(typeof gameId).toBe('string');
      expect(gameId.length).toBeGreaterThan(0);
      expect(mockGameRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-1',
          variant: 'texas-holdem',
          mode: 'cash',
          status: 'in-progress',
        }),
      );
      expect(mockGameRepository.save).toHaveBeenCalled();
    });

    it('should make isGameActive return true', async () => {
      const room = makeRoom() as Room;

      expect(service.isGameActive('room-1')).toBe(false);

      await service.startGame(room);

      expect(service.isGameActive('room-1')).toBe(true);
    });
  });

  describe('getPublicState', () => {
    it('should return null for non-existent room', () => {
      const result = service.getPublicState('non-existent');
      expect(result).toBeNull();
    });

    it('should return sanitized state without deck field', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);

      const publicState = service.getPublicState('room-1');

      expect(publicState).not.toBeNull();
      expect(publicState).toHaveProperty('phase');
      expect(publicState).toHaveProperty('communityCards');
      expect(publicState).toHaveProperty('pot');
      expect(publicState).toHaveProperty('players');
      expect(publicState).toHaveProperty('handNumber');
      expect(publicState).not.toHaveProperty('deck');

      // Players should not expose holeCards directly
      for (const p of publicState!.players) {
        expect(p).not.toHaveProperty('holeCards');
        expect(p).toHaveProperty('cardCount');
      }
    });
  });

  describe('getPrivateStates', () => {
    it('should return null for non-existent room', () => {
      expect(service.getPrivateStates('non-existent')).toBeNull();
    });

    it('should return copies of hole cards per player', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);

      const privateStates = service.getPrivateStates('room-1');

      expect(privateStates).not.toBeNull();
      expect(privateStates).toHaveProperty('p1');
      expect(privateStates).toHaveProperty('p2');
      expect(Array.isArray(privateStates!['p1'])).toBe(true);
      expect(Array.isArray(privateStates!['p2'])).toBe(true);
    });
  });

  describe('handleAction', () => {
    it('should throw when no active game exists', async () => {
      await expect(
        service.handleAction('non-existent', 'p1', {
          type: 'fold',
        }),
      ).rejects.toThrow('진행 중인 게임이 없습니다.');
    });

    it('should process a fold action without error', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);

      // Determine which player's turn it is
      const actionRequired = service.getActionRequired('room-1');
      expect(actionRequired).not.toBeNull();

      const result = await service.handleAction(
        'room-1',
        actionRequired!.playerUuid,
        { type: 'fold' },
      );

      expect(result).toHaveProperty('handComplete');
      expect(result).toHaveProperty('gameOver');
    });
  });

  describe('startNextHand', () => {
    it('should throw when no active game', () => {
      expect(() => service.startNextHand('non-existent')).toThrow(
        '진행 중인 게임이 없습니다.',
      );
    });

    it('should increment hand number', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);

      const stateBefore = service.getPublicState('room-1')!;
      const handBefore = stateBefore.handNumber;

      // Complete the current hand via fold so we can start next
      const actionRequired = service.getActionRequired('room-1')!;
      await service.handleAction('room-1', actionRequired.playerUuid, {
        type: 'fold',
      });

      service.startNextHand('room-1');

      const stateAfter = service.getPublicState('room-1')!;
      expect(stateAfter.handNumber).toBe(handBefore + 1);
    });
  });

  describe('isGameActive', () => {
    it('should return false for non-existent room', () => {
      expect(service.isGameActive('non-existent')).toBe(false);
    });

    it('should return true after game starts', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);
      expect(service.isGameActive('room-1')).toBe(true);
    });
  });

  describe('getActionRequired', () => {
    it('should return null for non-existent room', () => {
      expect(service.getActionRequired('non-existent')).toBeNull();
    });

    it('should return valid actions for the current player', async () => {
      const room = makeRoom() as Room;
      await service.startGame(room);

      const actionRequired = service.getActionRequired('room-1');

      expect(actionRequired).not.toBeNull();
      expect(actionRequired).toHaveProperty('playerUuid');
      expect(actionRequired).toHaveProperty('validActions');
      expect(actionRequired).toHaveProperty('timeLimit', 30);
      expect(Array.isArray(actionRequired!.validActions)).toBe(true);
    });
  });

  describe('deleteInProgressGamesByRoom', () => {
    beforeEach(() => {
      mockGameRepository.manager.connection.createQueryRunner.mockReturnValue(
        mockQueryRunnerForDelete,
      );
    });

    it('should only delete in-progress games, preserving completed games', async () => {
      const inProgressGame = { id: 'game-1', status: 'in-progress' };
      mockQueryRunnerForDelete.manager.find.mockResolvedValue([inProgressGame]);

      await service.deleteInProgressGamesByRoom('room-1');

      expect(mockQueryRunnerForDelete.manager.find).toHaveBeenCalledWith(
        Game,
        { where: { roomId: 'room-1', status: 'in-progress' } },
      );
      expect(mockDeleteQueryBuilder.from).toHaveBeenCalledWith(
        GameParticipant,
      );
      expect(mockDeleteQueryBuilder.where).toHaveBeenCalledWith(
        'gameId IN (:...gameIds)',
        { gameIds: ['game-1'] },
      );
      expect(mockQueryRunnerForDelete.manager.remove).toHaveBeenCalledWith([
        inProgressGame,
      ]);
      expect(
        mockQueryRunnerForDelete.commitTransaction,
      ).toHaveBeenCalled();
    });

    it('should not delete any records when only completed games exist', async () => {
      mockQueryRunnerForDelete.manager.find.mockResolvedValue([]);

      await service.deleteInProgressGamesByRoom('room-1');

      expect(mockQueryRunnerForDelete.manager.find).toHaveBeenCalledWith(
        Game,
        { where: { roomId: 'room-1', status: 'in-progress' } },
      );
      expect(
        mockQueryRunnerForDelete.manager.createQueryBuilder,
      ).not.toHaveBeenCalled();
      expect(
        mockQueryRunnerForDelete.commitTransaction,
      ).toHaveBeenCalled();
      expect(mockQueryRunnerForDelete.release).toHaveBeenCalled();
    });

    it('should rollback on error and release query runner', async () => {
      const error = new Error('DB error');
      mockQueryRunnerForDelete.manager.find.mockRejectedValue(error);

      await expect(
        service.deleteInProgressGamesByRoom('room-1'),
      ).rejects.toThrow('DB error');

      expect(
        mockQueryRunnerForDelete.rollbackTransaction,
      ).toHaveBeenCalled();
      expect(mockQueryRunnerForDelete.release).toHaveBeenCalled();
    });
  });
});
