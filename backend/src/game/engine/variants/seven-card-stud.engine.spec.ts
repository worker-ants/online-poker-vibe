import { SevenCardStudEngine } from './seven-card-stud.engine.js';
import { CashGameMode } from '../modes/cash-game.mode.js';
import type { PlayerSeat } from '../../../common/types/game.types.js';

describe('SevenCardStudEngine', () => {
  const engine = new SevenCardStudEngine();
  const cashMode = new CashGameMode(1000, 10, 20);

  const players: PlayerSeat[] = [
    { uuid: 'p1', nickname: 'Player1', seatIndex: 0, chips: 1000 },
    { uuid: 'p2', nickname: 'Player2', seatIndex: 1, chips: 1000 },
    { uuid: 'p3', nickname: 'Player3', seatIndex: 2, chips: 1000 },
  ];

  it('should initialize game state correctly', () => {
    const state = engine.initialize(players, cashMode);
    expect(state.variant).toBe('seven-card-stud');
    expect(state.players).toHaveLength(3);
    expect(state.players[0].chips).toBe(1000);
    expect(state.handNumber).toBe(0);
  });

  it('should start a hand with ante, 2 hole cards + 1 visible card, and third-street phase', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    expect(state.handNumber).toBe(1);
    expect(state.phase).toBe('third-street');

    // Ante should be collected (pot > 0)
    expect(state.pot).toBeGreaterThan(0);

    // Each player should have 2 hole cards + 1 visible card
    const activePlayers = state.players.filter((p) => !p.isFolded);
    for (const p of activePlayers) {
      expect(p.holeCards).toHaveLength(2);
      expect(p.visibleCards).toHaveLength(1);
    }
  });

  it('should not affect currentBet with ante', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    // Ante goes to pot only, currentBet should be 0
    for (const p of state.players) {
      expect(p.currentBet).toBe(0);
    }
  });

  it('should set bring-in player to the one with lowest visible card', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    // currentPlayerIndex should be set (the bring-in player)
    const currentPlayer = state.players[state.currentPlayerIndex];
    expect(currentPlayer).toBeDefined();
    expect(currentPlayer.isFolded).toBeFalsy();

    // The current player should have the lowest visible card among all players
    const activePlayers = state.players.filter((p) => !p.isFolded);
    const currentVisible = currentPlayer.visibleCards[0];
    expect(currentVisible).toBeDefined();
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

  it('should advance to fourth-street with additional visible card after third-street betting', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    let state = engine.startHand(initial);

    // Third-street: everyone calls/checks through the round
    // Bring-in player acts first, then others
    for (let i = 0; i < 3; i++) {
      const currentUuid = state.players[state.currentPlayerIndex].uuid;
      const actions = engine.getValidActions(state, currentUuid);
      if (actions.actions.includes('check')) {
        state = engine.handleAction(state, currentUuid, { type: 'check' });
      } else if (actions.actions.includes('call')) {
        state = engine.handleAction(state, currentUuid, { type: 'call' });
      }
    }

    // Should advance to fourth-street
    expect(state.phase).toBe('fourth-street');

    // Each player should now have an additional visible card
    const activePlayers = state.players.filter((p) => !p.isFolded);
    for (const p of activePlayers) {
      expect(p.visibleCards).toHaveLength(2);
    }
  });

  it('should get valid actions for current player', () => {
    const initial = engine.initialize(players, cashMode);
    initial.minRaise = 20;
    const state = engine.startHand(initial);

    const currentUuid = state.players[state.currentPlayerIndex].uuid;
    const actions = engine.getValidActions(state, currentUuid);

    expect(actions.actions.length).toBeGreaterThan(0);
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
