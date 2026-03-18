import { TexasHoldemEngine } from './texas-holdem.engine.js';
import { CashGameMode } from '../modes/cash-game.mode.js';
import type { PlayerSeat } from '../../../common/types/game.types.js';

describe('TexasHoldemEngine', () => {
  const engine = new TexasHoldemEngine();
  const cashMode = new CashGameMode(1000, 10, 20);

  const players: PlayerSeat[] = [
    { uuid: 'p1', nickname: 'Player1', seatIndex: 0, chips: 1000 },
    { uuid: 'p2', nickname: 'Player2', seatIndex: 1, chips: 1000 },
    { uuid: 'p3', nickname: 'Player3', seatIndex: 2, chips: 1000 },
  ];

  it('should initialize game state correctly', () => {
    const state = engine.initialize(players, cashMode);
    expect(state.variant).toBe('texas-holdem');
    expect(state.players).toHaveLength(3);
    expect(state.players[0].chips).toBe(1000);
    expect(state.handNumber).toBe(0);
  });

  it('should start a hand with proper blinds and dealing', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    expect(state.handNumber).toBe(1);
    expect(state.phase).toBe('pre-flop');
    expect(state.communityCards).toHaveLength(0);

    // Each player should have 2 hole cards
    const activePlayers = state.players.filter((p) => !p.isFolded);
    for (const p of activePlayers) {
      expect(p.holeCards).toHaveLength(2);
    }

    // Blinds should be posted
    expect(state.pot).toBeGreaterThan(0);
    expect(state.currentBet).toBe(20);
  });

  it('should handle a complete hand with all folds', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // UTG (p3) folds
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'fold',
      },
    );

    // SB (p1) folds
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'fold',
      },
    );

    // The remaining player (BB) should win
    expect(engine.isHandComplete(state)).toBe(true);
    const result = engine.resolveHand(state);
    expect(result.winners).toHaveLength(1);
    // Winner should be the only non-folded player
    const remainingPlayer = state.players.find((p) => !p.isFolded);
    expect(result.winners[0].uuid).toBe(remainingPlayer!.uuid);
  });

  it('should handle a complete hand through to showdown', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // Pre-flop: everyone calls
    // UTG calls
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'call',
      },
    );
    // SB calls
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'call',
      },
    );
    // BB checks
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'check',
      },
    );

    // Should now be on the flop
    expect(state.phase).toBe('flop');
    expect(state.communityCards).toHaveLength(3);

    // Flop: everyone checks
    for (let i = 0; i < 3; i++) {
      state = engine.handleAction(
        state,
        state.players[state.currentPlayerIndex].uuid,
        {
          type: 'check',
        },
      );
    }

    // Should now be on the turn
    expect(state.phase).toBe('turn');
    expect(state.communityCards).toHaveLength(4);

    // Turn: everyone checks
    for (let i = 0; i < 3; i++) {
      state = engine.handleAction(
        state,
        state.players[state.currentPlayerIndex].uuid,
        {
          type: 'check',
        },
      );
    }

    // Should now be on the river
    expect(state.phase).toBe('river');
    expect(state.communityCards).toHaveLength(5);

    // River: everyone checks
    for (let i = 0; i < 3; i++) {
      state = engine.handleAction(
        state,
        state.players[state.currentPlayerIndex].uuid,
        {
          type: 'check',
        },
      );
    }

    // Should now be showdown
    expect(state.phase).toBe('showdown');
    expect(engine.isHandComplete(state)).toBe(true);

    const result = engine.resolveHand(state);
    expect(result.winners.length).toBeGreaterThanOrEqual(1);
    expect(result.playerHands.length).toBe(3);
  });

  it('should handle raise and re-raise', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // UTG raises to 40
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'raise',
        amount: 40,
      },
    );

    expect(state.currentBet).toBe(40);

    // SB calls
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'call',
      },
    );

    // BB re-raises to 80
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      {
        type: 'raise',
        amount: 80,
      },
    );

    expect(state.currentBet).toBe(80);
  });

  it('should handle heads-up correctly (2 players)', () => {
    const headsUpPlayers: PlayerSeat[] = [
      { uuid: 'p1', nickname: 'Player1', seatIndex: 0, chips: 1000 },
      { uuid: 'p2', nickname: 'Player2', seatIndex: 1, chips: 1000 },
    ];

    const initial = engine.initialize(headsUpPlayers, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    // In heads-up, dealer is SB
    expect(state.smallBlindIndex).toBe(state.dealerIndex);
    expect(state.players.filter((p) => !p.isFolded)).toHaveLength(2);
  });

  it('should get valid actions for current player', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    const currentUuid = state.players[state.currentPlayerIndex].uuid;
    const actions = engine.getValidActions(state, currentUuid);

    expect(actions.actions).toContain('fold');
    expect(actions.actions).toContain('call');
    expect(actions.actions).toContain('raise');
    expect(actions.callAmount).toBe(20);
  });

  it('should return empty actions for non-current player', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    const notCurrentUuid =
      state.players[(state.currentPlayerIndex + 1) % 3].uuid;
    const actions = engine.getValidActions(state, notCurrentUuid);

    expect(actions.actions).toHaveLength(0);
  });
});
