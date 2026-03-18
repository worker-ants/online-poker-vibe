import { FiveCardDrawEngine } from './five-card-draw.engine.js';
import { CashGameMode } from '../modes/cash-game.mode.js';
import type { PlayerSeat } from '../../../common/types/game.types.js';

describe('FiveCardDrawEngine', () => {
  const engine = new FiveCardDrawEngine();
  const cashMode = new CashGameMode(1000, 10, 20);

  const players: PlayerSeat[] = [
    { uuid: 'p1', nickname: 'Player1', seatIndex: 0, chips: 1000 },
    { uuid: 'p2', nickname: 'Player2', seatIndex: 1, chips: 1000 },
    { uuid: 'p3', nickname: 'Player3', seatIndex: 2, chips: 1000 },
  ];

  it('should initialize game state correctly', () => {
    const state = engine.initialize(players, cashMode);
    expect(state.variant).toBe('five-card-draw');
    expect(state.players).toHaveLength(3);
    expect(state.players[0].chips).toBe(1000);
    expect(state.handNumber).toBe(0);
  });

  it('should start a hand with 5 hole cards and proper blinds', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    expect(state.handNumber).toBe(1);
    expect(state.phase).toBe('first-bet');
    expect(state.pot).toBeGreaterThan(0);
    expect(state.currentBet).toBe(20);

    // Each player should have 5 hole cards
    const activePlayers = state.players.filter((p) => !p.isFolded);
    for (const p of activePlayers) {
      expect(p.holeCards).toHaveLength(5);
    }
  });

  it('should handle a complete hand with all folds', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // Fold all but one player
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'fold' },
    );

    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'fold' },
    );

    // The remaining player should win
    expect(engine.isHandComplete(state)).toBe(true);
    const result = engine.resolveHand(state);
    expect(result.winners).toHaveLength(1);
    const remainingPlayer = state.players.find((p) => !p.isFolded);
    expect(result.winners[0].uuid).toBe(remainingPlayer!.uuid);
  });

  it('should advance to draw phase after first-bet round completes', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // First-bet: UTG calls, SB calls, BB checks
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'call' },
    );
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'call' },
    );
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'check' },
    );

    // Should now be in draw phase
    expect(state.phase).toBe('draw');

    // Handle draw action with discardIndices
    const currentUuid = state.players[state.currentPlayerIndex].uuid;
    state = engine.handleAction(state, currentUuid, {
      type: 'draw',
      discardIndices: [0, 1],
    });

    // Player should still have 5 cards after drawing
    const playerAfter = state.players.find((p) => p.uuid === currentUuid)!;
    expect(playerAfter.holeCards).toHaveLength(5);
  });

  it('should handle a full hand through showdown', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // First-bet: everyone calls/checks
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'call' },
    );
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'call' },
    );
    state = engine.handleAction(
      state,
      state.players[state.currentPlayerIndex].uuid,
      { type: 'check' },
    );

    expect(state.phase).toBe('draw');

    // Draw phase: each player draws (stand pat with empty discard)
    for (let i = 0; i < 3; i++) {
      state = engine.handleAction(
        state,
        state.players[state.currentPlayerIndex].uuid,
        { type: 'draw', discardIndices: [] },
      );
    }

    // Should now be in second-bet phase
    expect(state.phase).toBe('second-bet');

    // Second-bet: everyone checks
    for (let i = 0; i < 3; i++) {
      state = engine.handleAction(
        state,
        state.players[state.currentPlayerIndex].uuid,
        { type: 'check' },
      );
    }

    // Should now be showdown
    expect(state.phase).toBe('showdown');
    expect(engine.isHandComplete(state)).toBe(true);

    const result = engine.resolveHand(state);
    expect(result.winners.length).toBeGreaterThanOrEqual(1);
    expect(result.playerHands.length).toBe(3);
  });

  it('should handle heads-up correctly (2 players)', () => {
    const headsUpPlayers: PlayerSeat[] = [
      { uuid: 'p1', nickname: 'Player1', seatIndex: 0, chips: 1000 },
      { uuid: 'p2', nickname: 'Player2', seatIndex: 1, chips: 1000 },
    ];

    const initial = engine.initialize(headsUpPlayers, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    // In heads-up, dealer is small blind
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
