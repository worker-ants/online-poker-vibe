import type { IPokerEngine } from '../poker-engine.interface.js';
import type { IGameMode } from '../modes/game-mode.interface.js';
import type {
  GameState,
  PlayerAction,
  PlayerSeat,
  HandResult,
  BettingAction,
  StudPhase,
} from '../../../common/types/game.types.js';
import { RANK_VALUES, SUIT_VALUES } from '../../../common/types/card.types.js';
import type { Card } from '../../../common/types/card.types.js';
import { Deck } from '../deck.js';
import { HandEvaluator } from '../hand-evaluator.js';
import { BettingRound } from '../betting-round.js';
import { PotCalculator } from '../pot-calculator.js';
import { resolveHand } from '../resolve-hand.js';
import { v4 as uuidv4 } from 'uuid';

export class SevenCardStudEngine implements IPokerEngine {
  readonly variant = 'seven-card-stud' as const;
  private handEvaluator = new HandEvaluator();
  private bettingRound = new BettingRound();
  private potCalculator = new PotCalculator();

  initialize(players: PlayerSeat[], mode: IGameMode): GameState {
    return {
      gameId: uuidv4(),
      variant: 'seven-card-stud',
      phase: 'ante' as StudPhase,
      deck: [],
      communityCards: [],
      players: players.map((p) => ({
        uuid: p.uuid,
        nickname: p.nickname,
        seatIndex: p.seatIndex,
        chips: mode.getStartingChips(),
        currentBet: 0,
        holeCards: [],
        visibleCards: [],
        isFolded: false,
        isAllIn: false,
        isDisconnected: false,
        hasActed: false,
      })),
      pot: 0,
      sidePots: [],
      currentPlayerIndex: 0,
      dealerIndex: 0,
      smallBlindIndex: 0,
      bigBlindIndex: 0,
      currentBet: 0,
      minRaise: mode.getBigBlind(1),
      roundHistory: [],
      handNumber: 0,
    };
  }

  startHand(state: GameState): GameState {
    const newState = structuredClone(state);
    newState.handNumber++;

    // Reset players
    newState.players.forEach((p) => {
      p.currentBet = 0;
      p.holeCards = [];
      p.visibleCards = [];
      p.isFolded = p.chips <= 0;
      p.isAllIn = false;
      p.hasActed = false;
    });

    newState.pot = 0;
    newState.sidePots = [];
    newState.communityCards = [];
    newState.currentBet = 0;
    newState.roundHistory = [];

    // Shuffle deck
    const deck = new Deck();
    deck.shuffle();
    newState.deck = deck.getCards();

    // Collect ante from all players
    const ante = Math.max(1, Math.floor(newState.minRaise / 5));
    for (const player of newState.players) {
      if (player.isFolded) continue;
      const anteAmount = Math.min(ante, player.chips);
      player.chips -= anteAmount;
      newState.pot += anteAmount;
      if (player.chips === 0) player.isAllIn = true;
    }

    // Deal Third Street: 2 face-down + 1 face-up to each player
    const deckCards = [...newState.deck];
    for (const player of newState.players) {
      if (player.isFolded) continue;
      player.holeCards = deckCards.splice(0, 2); // 2 face-down
      player.visibleCards = deckCards.splice(0, 1); // 1 face-up
    }
    newState.deck = deckCards;

    // Find player with lowest visible card (bring-in)
    const bringInPlayer = this.findBringInPlayer(newState);
    newState.currentPlayerIndex = bringInPlayer;
    newState.phase = 'third-street';

    return newState;
  }

  handleAction(
    state: GameState,
    playerUuid: string,
    action: PlayerAction,
  ): GameState {
    let newState = this.bettingRound.applyAction(state, playerUuid, action);

    if (this.bettingRound.isRoundComplete(newState)) {
      newState = this.advancePhase(newState);
    }

    return newState;
  }

  getValidActions(
    state: GameState,
    playerUuid: string,
  ): {
    actions: BettingAction[];
    callAmount: number;
    minRaise: number;
    maxRaise: number;
  } {
    const playerIndex = state.players.findIndex((p) => p.uuid === playerUuid);
    if (playerIndex !== state.currentPlayerIndex) {
      return { actions: [], callAmount: 0, minRaise: 0, maxRaise: 0 };
    }
    return this.bettingRound.getValidActions(state);
  }

  isHandComplete(state: GameState): boolean {
    return (
      state.phase === 'showdown' ||
      this.bettingRound.isOnlyOnePlayerRemaining(state)
    );
  }

  resolveHand(state: GameState): HandResult {
    return resolveHand(
      state,
      this.handEvaluator,
      this.potCalculator,
      (player) => [...player.holeCards, ...player.visibleCards],
    );
  }

  private advancePhase(state: GameState): GameState {
    const newState = structuredClone(state);

    if (this.bettingRound.isOnlyOnePlayerRemaining(newState)) {
      newState.phase = 'showdown';
      return newState;
    }

    // Reset for new betting round
    newState.currentBet = 0;
    newState.players.forEach((p) => {
      p.currentBet = 0;
      p.hasActed = false;
    });

    const deckCards = [...newState.deck];
    const phase = newState.phase as StudPhase;

    switch (phase) {
      case 'third-street':
        // Fourth Street: deal 1 face-up card
        for (const player of newState.players) {
          if (!player.isFolded && !player.isAllIn) {
            player.visibleCards.push(deckCards.splice(0, 1)[0]);
          } else if (!player.isFolded) {
            player.visibleCards.push(deckCards.splice(0, 1)[0]);
          }
        }
        newState.phase = 'fourth-street';
        // Highest visible hand acts first
        newState.currentPlayerIndex = this.findHighestVisibleHand(newState);
        break;

      case 'fourth-street':
        for (const player of newState.players) {
          if (!player.isFolded) {
            player.visibleCards.push(deckCards.splice(0, 1)[0]);
          }
        }
        newState.phase = 'fifth-street';
        newState.currentPlayerIndex = this.findHighestVisibleHand(newState);
        break;

      case 'fifth-street':
        for (const player of newState.players) {
          if (!player.isFolded) {
            player.visibleCards.push(deckCards.splice(0, 1)[0]);
          }
        }
        newState.phase = 'sixth-street';
        newState.currentPlayerIndex = this.findHighestVisibleHand(newState);
        break;

      case 'sixth-street':
        // Seventh Street: deal 1 face-down card
        for (const player of newState.players) {
          if (!player.isFolded) {
            player.holeCards.push(deckCards.splice(0, 1)[0]);
          }
        }
        newState.phase = 'seventh-street';
        newState.currentPlayerIndex = this.findHighestVisibleHand(newState);
        break;

      case 'seventh-street':
        newState.phase = 'showdown';
        break;

      default:
        break;
    }

    newState.deck = deckCards;

    // If all remaining players are all-in, auto-advance
    const canAct = newState.players.filter((p) => !p.isFolded && !p.isAllIn);
    if (canAct.length <= 1 && newState.phase !== 'showdown') {
      return this.advancePhase(newState);
    }

    return newState;
  }

  private findBringInPlayer(state: GameState): number {
    let lowestIndex = -1;
    let lowestValue = Infinity;
    let lowestSuit = Infinity;

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (player.isFolded || player.visibleCards.length === 0) continue;

      const card = player.visibleCards[0];
      const value = RANK_VALUES[card.rank];
      const suitValue = SUIT_VALUES[card.suit];

      if (
        value < lowestValue ||
        (value === lowestValue && suitValue < lowestSuit)
      ) {
        lowestValue = value;
        lowestSuit = suitValue;
        lowestIndex = i;
      }
    }

    return lowestIndex;
  }

  /**
   * Rank visible cards for betting order by evaluating actual hand strength.
   * Returns a numeric score: higher is better.
   * Uses rank counts (pairs > high cards) and then compares kicker values.
   */
  private scoreVisibleCards(visibleCards: Card[]): number[] {
    const values = visibleCards
      .map((c) => RANK_VALUES[c.rank])
      .sort((a, b) => b - a);

    // Count occurrences of each value
    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    // Sort entries: by count desc, then by value desc
    const entries = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

    // Build a score array: [maxGroupSize, val1, val2, ...]
    // This ensures pairs > high cards, trips > pairs, etc.
    const score: number[] = [entries[0]?.[1] ?? 0];
    for (const [val] of entries) {
      score.push(val);
    }
    return score;
  }

  private findHighestVisibleHand(state: GameState): number {
    let highestIndex = 0;
    let highestScore: number[] = [];

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (player.isFolded) continue;

      const score = this.scoreVisibleCards(player.visibleCards);

      // Compare score arrays lexicographically
      if (this.compareScoreArrays(score, highestScore) > 0) {
        highestScore = score;
        highestIndex = i;
      }
    }

    return highestIndex;
  }

  private compareScoreArrays(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }
}
