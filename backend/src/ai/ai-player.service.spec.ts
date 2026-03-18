import { AiPlayerService } from './ai-player.service.js';
import type { Card } from '../common/types/card.types.js';
import type {
  GameState,
  PlayerState,
  BettingAction,
} from '../common/types/game.types.js';

describe('AiPlayerService', () => {
  let service: AiPlayerService;

  beforeEach(() => {
    service = new AiPlayerService();
  });

  describe('createAiPlayers', () => {
    it('빈 좌석에 올바르게 AI 플레이어를 생성해야 한다', () => {
      const occupied = new Set([0, 2]);
      const aiPlayers = service.createAiPlayers(3, occupied);

      expect(aiPlayers).toHaveLength(3);
      expect(aiPlayers[0].uuid).toBe('ai-player-1');
      expect(aiPlayers[0].nickname).toBe('[AI] Alice');
      expect(aiPlayers[0].seatIndex).toBe(1);

      expect(aiPlayers[1].uuid).toBe('ai-player-2');
      expect(aiPlayers[1].nickname).toBe('[AI] Bob');
      expect(aiPlayers[1].seatIndex).toBe(3);

      expect(aiPlayers[2].uuid).toBe('ai-player-3');
      expect(aiPlayers[2].nickname).toBe('[AI] Charlie');
      expect(aiPlayers[2].seatIndex).toBe(4);
    });

    it('AI 플레이어가 0명이면 빈 배열을 반환해야 한다', () => {
      const result = service.createAiPlayers(0, new Set([0]));
      expect(result).toHaveLength(0);
    });
  });

  describe('evaluateHandStrength', () => {
    it('포켓 에이스는 높은 프리플롭 점수를 가져야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: 'A' },
      ];
      const score = service.evaluateHandStrength(
        holeCards,
        [],
        [],
        'texas-holdem',
        'pre-flop',
      );
      expect(score).toBeGreaterThanOrEqual(0.9);
    });

    it('7-2 오프수트는 낮은 프리플롭 점수를 가져야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: '7' },
        { suit: 'spades', rank: '2' },
      ];
      const score = service.evaluateHandStrength(
        holeCards,
        [],
        [],
        'texas-holdem',
        'pre-flop',
      );
      expect(score).toBeLessThan(0.3);
    });

    it('플러시는 높은 점수를 반환해야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'hearts', rank: 'K' },
      ];
      const communityCards: Card[] = [
        { suit: 'hearts', rank: '10' },
        { suit: 'hearts', rank: '5' },
        { suit: 'hearts', rank: '3' },
      ];
      const score = service.evaluateHandStrength(
        holeCards,
        communityCards,
        [],
        'texas-holdem',
        'flop',
      );
      expect(score).toBeGreaterThanOrEqual(0.7);
    });

    it('하이카드만 있으면 낮은 점수를 반환해야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: '7' },
      ];
      const communityCards: Card[] = [
        { suit: 'clubs', rank: '2' },
        { suit: 'diamonds', rank: '5' },
        { suit: 'spades', rank: '9' },
      ];
      const score = service.evaluateHandStrength(
        holeCards,
        communityCards,
        [],
        'texas-holdem',
        'flop',
      );
      expect(score).toBe(0.1); // High card
    });

    it('Seven Card Stud에서는 visibleCards를 사용해야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: 'A' },
      ];
      const visibleCards: Card[] = [
        { suit: 'clubs', rank: 'A' },
        { suit: 'diamonds', rank: 'K' },
        { suit: 'hearts', rank: 'Q' },
      ];
      const score = service.evaluateHandStrength(
        holeCards,
        [],
        visibleCards,
        'seven-card-stud',
        'fifth-street',
      );
      expect(score).toBeGreaterThanOrEqual(0.6); // Three of a kind
    });
  });

  describe('decideAction', () => {
    function makeGameState(
      overrides: Partial<GameState> = {},
      playerOverrides: Partial<PlayerState> = {},
    ): GameState {
      return {
        gameId: 'test',
        variant: 'texas-holdem',
        phase: 'flop',
        deck: [],
        communityCards: [
          { suit: 'clubs', rank: '2' },
          { suit: 'diamonds', rank: '5' },
          { suit: 'spades', rank: '9' },
        ],
        players: [
          {
            uuid: 'ai-player-1',
            nickname: '[AI] Alice',
            seatIndex: 0,
            chips: 1000,
            currentBet: 0,
            holeCards: [
              { suit: 'hearts', rank: 'A' },
              { suit: 'spades', rank: 'A' },
            ],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
            ...playerOverrides,
          },
          {
            uuid: 'human-1',
            nickname: 'Player',
            seatIndex: 1,
            chips: 1000,
            currentBet: 0,
            holeCards: [
              { suit: 'hearts', rank: '2' },
              { suit: 'clubs', rank: '3' },
            ],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
        ],
        pot: 100,
        sidePots: [],
        currentPlayerIndex: 0,
        dealerIndex: 1,
        smallBlindIndex: 0,
        bigBlindIndex: 1,
        currentBet: 0,
        minRaise: 20,
        roundHistory: [],
        handNumber: 1,
        ...overrides,
      };
    }

    it('강한 핸드로는 레이즈해야 한다', () => {
      const state = makeGameState();
      const validActions: {
        actions: BettingAction[];
        callAmount: number;
        minRaise: number;
        maxRaise: number;
      } = {
        actions: ['fold', 'check', 'raise', 'all-in'],
        callAmount: 0,
        minRaise: 20,
        maxRaise: 1000,
      };

      // Pocket aces on the flop should be strong
      const action = service.decideAction(
        state,
        'ai-player-1',
        validActions,
        'texas-holdem',
      );
      // Should either raise or check (never fold with strong hand)
      expect(action.type).not.toBe('fold');
    });

    it('약한 핸드로 베팅이 있으면 폴드해야 한다 (블러프 없을 때)', () => {
      // Fix random to avoid bluff
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const state = makeGameState(
        { currentBet: 200 },
        {
          holeCards: [
            { suit: 'hearts', rank: '7' },
            { suit: 'spades', rank: '2' },
          ],
        },
      );
      const validActions: {
        actions: BettingAction[];
        callAmount: number;
        minRaise: number;
        maxRaise: number;
      } = {
        actions: ['fold', 'call', 'raise', 'all-in'],
        callAmount: 200,
        minRaise: 400,
        maxRaise: 1000,
      };

      const action = service.decideAction(
        state,
        'ai-player-1',
        validActions,
        'texas-holdem',
      );
      expect(action.type).toBe('fold');

      jest.restoreAllMocks();
    });

    it('체크가 가능하면 약한 핸드로도 폴드하지 않아야 한다', () => {
      const state = makeGameState(
        {},
        {
          holeCards: [
            { suit: 'hearts', rank: '7' },
            { suit: 'spades', rank: '2' },
          ],
        },
      );
      const validActions: {
        actions: BettingAction[];
        callAmount: number;
        minRaise: number;
        maxRaise: number;
      } = {
        actions: ['fold', 'check', 'raise', 'all-in'],
        callAmount: 0,
        minRaise: 20,
        maxRaise: 1000,
      };

      // Run multiple times
      for (let i = 0; i < 20; i++) {
        const action = service.decideAction(
          state,
          'ai-player-1',
          validActions,
          'texas-holdem',
        );
        // Should check, not fold (free check)
        expect(action.type).not.toBe('fold');
      }
    });

    it('유효한 액션만 반환해야 한다', () => {
      const state = makeGameState();
      const validActions: {
        actions: BettingAction[];
        callAmount: number;
        minRaise: number;
        maxRaise: number;
      } = {
        actions: ['fold', 'call'],
        callAmount: 20,
        minRaise: 0,
        maxRaise: 0,
      };

      for (let i = 0; i < 50; i++) {
        const action = service.decideAction(
          state,
          'ai-player-1',
          validActions,
          'texas-holdem',
        );
        expect(['fold', 'call']).toContain(action.type);
      }
    });

    it('다른 플레이어의 홀카드에 접근하지 않아야 한다', () => {
      const state = makeGameState();

      // AI player is index 0, should only use its own hole cards
      const evaluateSpy = jest.spyOn(service, 'evaluateHandStrength');

      service.decideAction(
        state,
        'ai-player-1',
        { actions: ['fold', 'check'], callAmount: 0, minRaise: 0, maxRaise: 0 },
        'texas-holdem',
      );

      expect(evaluateSpy).toHaveBeenCalledWith(
        state.players[0].holeCards,
        state.communityCards,
        state.players[0].visibleCards,
        'texas-holdem',
        'flop',
      );
    });

    it('빈 액션 목록이면 폴드해야 한다', () => {
      const state = makeGameState();
      const validActions: {
        actions: BettingAction[];
        callAmount: number;
        minRaise: number;
        maxRaise: number;
      } = {
        actions: [],
        callAmount: 0,
        minRaise: 0,
        maxRaise: 0,
      };

      const action = service.decideAction(
        state,
        'ai-player-1',
        validActions,
        'texas-holdem',
      );
      expect(action.type).toBe('fold');
    });
  });

  describe('getDiscardIndices (Five Card Draw)', () => {
    it('페어를 유지하고 나머지를 버려야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'A' },
        { suit: 'spades', rank: 'A' },
        { suit: 'clubs', rank: '3' },
        { suit: 'diamonds', rank: '7' },
        { suit: 'hearts', rank: '5' },
      ];
      const indices = service.getDiscardIndices(holeCards);
      expect(indices).toEqual(expect.arrayContaining([2, 3, 4]));
      expect(indices).toHaveLength(3);
      expect(indices).not.toContain(0);
      expect(indices).not.toContain(1);
    });

    it('트립스를 유지하고 나머지를 버려야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: 'K' },
        { suit: 'spades', rank: 'K' },
        { suit: 'clubs', rank: 'K' },
        { suit: 'diamonds', rank: '3' },
        { suit: 'hearts', rank: '5' },
      ];
      const indices = service.getDiscardIndices(holeCards);
      expect(indices).toHaveLength(2);
      expect(indices).toContain(3);
      expect(indices).toContain(4);
    });

    it('아무것도 없으면 가장 높은 카드만 유지해야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: '2' },
        { suit: 'spades', rank: '5' },
        { suit: 'clubs', rank: '8' },
        { suit: 'diamonds', rank: 'J' },
        { suit: 'hearts', rank: 'A' },
      ];
      const indices = service.getDiscardIndices(holeCards);
      expect(indices).toHaveLength(4);
      expect(indices).not.toContain(4); // Keep Ace
    });

    it('4장 플러시를 유지해야 한다', () => {
      const holeCards: Card[] = [
        { suit: 'hearts', rank: '2' },
        { suit: 'hearts', rank: '5' },
        { suit: 'hearts', rank: '8' },
        { suit: 'hearts', rank: 'J' },
        { suit: 'spades', rank: 'A' },
      ];
      const indices = service.getDiscardIndices(holeCards);
      expect(indices).toHaveLength(1);
      expect(indices).toContain(4); // Discard the non-hearts card
    });
  });

  describe('Five Card Draw draw phase', () => {
    it('드로우 페이즈에서 draw 액션을 반환해야 한다', () => {
      const state: GameState = {
        gameId: 'test',
        variant: 'five-card-draw',
        phase: 'draw',
        deck: [],
        communityCards: [],
        players: [
          {
            uuid: 'ai-player-1',
            nickname: '[AI] Alice',
            seatIndex: 0,
            chips: 1000,
            currentBet: 0,
            holeCards: [
              { suit: 'hearts', rank: 'A' },
              { suit: 'spades', rank: 'A' },
              { suit: 'clubs', rank: '3' },
              { suit: 'diamonds', rank: '7' },
              { suit: 'hearts', rank: '5' },
            ],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
        ],
        pot: 100,
        sidePots: [],
        currentPlayerIndex: 0,
        dealerIndex: 0,
        smallBlindIndex: 0,
        bigBlindIndex: 0,
        currentBet: 0,
        minRaise: 20,
        roundHistory: [],
        handNumber: 1,
      };

      const action = service.decideAction(
        state,
        'ai-player-1',
        { actions: [], callAmount: 0, minRaise: 0, maxRaise: 0 },
        'five-card-draw',
      );

      expect(action.type).toBe('draw');
      expect(action.discardIndices).toBeDefined();
      expect(action.discardIndices!.length).toBe(3); // Discard non-pair cards
    });
  });
});
