import { BettingRound } from './betting-round.js';
import type { GameState, PlayerState } from '../../common/types/game.types.js';

describe('BettingRound', () => {
  let bettingRound: BettingRound;

  beforeEach(() => {
    bettingRound = new BettingRound();
  });

  function makeState(overrides?: Partial<GameState>): GameState {
    const defaultPlayers: PlayerState[] = [
      {
        uuid: 'p1',
        nickname: 'Player1',
        seatIndex: 0,
        chips: 980,
        currentBet: 10,
        holeCards: [],
        visibleCards: [],
        isFolded: false,
        isAllIn: false,
        isDisconnected: false,
        hasActed: false,
      },
      {
        uuid: 'p2',
        nickname: 'Player2',
        seatIndex: 1,
        chips: 960,
        currentBet: 20,
        holeCards: [],
        visibleCards: [],
        isFolded: false,
        isAllIn: false,
        isDisconnected: false,
        hasActed: false,
      },
      {
        uuid: 'p3',
        nickname: 'Player3',
        seatIndex: 2,
        chips: 1000,
        currentBet: 0,
        holeCards: [],
        visibleCards: [],
        isFolded: false,
        isAllIn: false,
        isDisconnected: false,
        hasActed: false,
      },
    ];

    return {
      gameId: 'test-game',
      variant: 'texas-holdem',
      phase: 'pre-flop',
      deck: [],
      communityCards: [],
      players: defaultPlayers,
      pot: 30,
      sidePots: [],
      currentPlayerIndex: 2, // Player3's turn (UTG)
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 1,
      currentBet: 20,
      minRaise: 20,
      roundHistory: [],
      handNumber: 1,
      ...overrides,
    };
  }

  describe('getValidActions', () => {
    it('should return fold, call, raise, all-in when there is a bet', () => {
      const state = makeState();
      const result = bettingRound.getValidActions(state);
      expect(result.actions).toContain('fold');
      expect(result.actions).toContain('call');
      expect(result.actions).toContain('raise');
      expect(result.actions).toContain('all-in');
      expect(result.actions).not.toContain('check');
      expect(result.callAmount).toBe(20);
    });

    it('should allow check when no bet', () => {
      const state = makeState({
        currentBet: 0,
        players: [
          {
            uuid: 'p1',
            nickname: 'Player1',
            seatIndex: 0,
            chips: 1000,
            currentBet: 0,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
          {
            uuid: 'p2',
            nickname: 'Player2',
            seatIndex: 1,
            chips: 1000,
            currentBet: 0,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
        ],
        currentPlayerIndex: 0,
      });
      const result = bettingRound.getValidActions(state);
      expect(result.actions).toContain('check');
    });
  });

  describe('applyAction', () => {
    it('should handle fold', () => {
      const state = makeState();
      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'fold',
      });
      expect(newState.players[2].isFolded).toBe(true);
      expect(newState.players[2].hasActed).toBe(true);
    });

    it('should handle call', () => {
      const state = makeState();
      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'call',
      });
      expect(newState.players[2].currentBet).toBe(20);
      expect(newState.players[2].chips).toBe(980);
      expect(newState.pot).toBe(50);
    });

    it('should handle raise', () => {
      const state = makeState();
      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'raise',
        amount: 40,
      });
      expect(newState.players[2].currentBet).toBe(40);
      expect(newState.players[2].chips).toBe(960);
      expect(newState.currentBet).toBe(40);
    });

    it('should handle all-in', () => {
      const state = makeState();
      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'all-in',
      });
      expect(newState.players[2].chips).toBe(0);
      expect(newState.players[2].isAllIn).toBe(true);
    });

    it('should throw when not player turn', () => {
      const state = makeState();
      expect(() =>
        bettingRound.applyAction(state, 'p1', { type: 'call' }),
      ).toThrow('현재 턴이 아닙니다');
    });

    it('should throw when trying to check with a bet', () => {
      const state = makeState();
      expect(() =>
        bettingRound.applyAction(state, 'p3', { type: 'check' }),
      ).toThrow('체크할 수 없습니다');
    });

    it('should advance to next player after action', () => {
      const state = makeState();
      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'call',
      });
      // After p3 calls, next player should be p1 (SB)
      expect(newState.currentPlayerIndex).toBe(0);
    });

    it('should reset other players hasActed on raise', () => {
      const state = makeState({
        players: [
          {
            uuid: 'p1',
            nickname: 'Player1',
            seatIndex: 0,
            chips: 980,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: true,
          },
          {
            uuid: 'p2',
            nickname: 'Player2',
            seatIndex: 1,
            chips: 960,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: true,
          },
          {
            uuid: 'p3',
            nickname: 'Player3',
            seatIndex: 2,
            chips: 980,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
        ],
        currentPlayerIndex: 2,
      });

      const newState = bettingRound.applyAction(state, 'p3', {
        type: 'raise',
        amount: 60,
      });

      expect(newState.players[0].hasActed).toBe(false);
      expect(newState.players[1].hasActed).toBe(false);
    });
  });

  describe('isRoundComplete', () => {
    it('should be complete when all active players have acted with equal bets', () => {
      const state = makeState({
        currentBet: 20,
        players: [
          {
            uuid: 'p1',
            nickname: 'P1',
            seatIndex: 0,
            chips: 980,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: true,
          },
          {
            uuid: 'p2',
            nickname: 'P2',
            seatIndex: 1,
            chips: 980,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: true,
          },
        ],
      });
      expect(bettingRound.isRoundComplete(state)).toBe(true);
    });

    it('should not be complete when player has not acted', () => {
      const state = makeState();
      expect(bettingRound.isRoundComplete(state)).toBe(false);
    });

    it('should be complete when only one player not folded', () => {
      const state = makeState({
        players: [
          {
            uuid: 'p1',
            nickname: 'P1',
            seatIndex: 0,
            chips: 980,
            currentBet: 20,
            holeCards: [],
            visibleCards: [],
            isFolded: true,
            isAllIn: false,
            isDisconnected: false,
            hasActed: true,
          },
          {
            uuid: 'p2',
            nickname: 'P2',
            seatIndex: 1,
            chips: 1000,
            currentBet: 0,
            holeCards: [],
            visibleCards: [],
            isFolded: false,
            isAllIn: false,
            isDisconnected: false,
            hasActed: false,
          },
        ],
      });
      expect(bettingRound.isRoundComplete(state)).toBe(true);
    });
  });
});
