import type { IPokerEngine } from '../poker-engine.interface.js';
import type { IGameMode } from '../modes/game-mode.interface.js';
import type {
  GameState,
  PlayerAction,
  PlayerSeat,
  PlayerState,
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
import { v4 as uuidv4 } from 'uuid';

export class SevenCardStudEngine implements IPokerEngine {
  readonly variant = 'seven-card-stud' as const;
  private deck = new Deck();
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
    const newState: GameState = JSON.parse(JSON.stringify(state));
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
    this.deck.reset();
    this.deck.shuffle();
    newState.deck = this.deck.getCards();

    // Collect ante from all players
    const ante = Math.max(1, Math.floor(newState.minRaise / 5));
    for (const player of newState.players) {
      if (player.isFolded) continue;
      const anteAmount = Math.min(ante, player.chips);
      player.chips -= anteAmount;
      player.currentBet = anteAmount;
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

    // Reset bets for the street
    newState.players.forEach((p) => {
      p.currentBet = 0;
      p.hasActed = false;
    });

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
    const activePlayers = state.players.filter((p) => !p.isFolded);

    if (activePlayers.length === 1) {
      return {
        winners: [
          {
            uuid: activePlayers[0].uuid,
            amount: state.pot,
            potType: 'main',
          },
        ],
        playerHands: [],
      };
    }

    const playerHands = activePlayers.map((p) => {
      const allCards = [...p.holeCards, ...p.visibleCards];
      const handRank = this.handEvaluator.evaluate(allCards);
      return { uuid: p.uuid, cards: allCards, handRank };
    });

    const pots = this.potCalculator.calculatePots(state.players);
    const winners: HandResult['winners'] = [];

    for (const pot of pots) {
      const eligible = playerHands.filter((ph) =>
        pot.playerUuids.includes(ph.uuid),
      );
      if (eligible.length === 0) continue;

      eligible.sort((a, b) =>
        this.handEvaluator.compareHands(b.handRank, a.handRank),
      );

      const bestHand = eligible[0].handRank;
      const tied = eligible.filter(
        (ph) => this.handEvaluator.compareHands(ph.handRank, bestHand) === 0,
      );

      const share = Math.floor(pot.amount / tied.length);
      const remainder = pot.amount % tied.length;

      tied.forEach((ph, i) => {
        winners.push({
          uuid: ph.uuid,
          amount: share + (i === 0 ? remainder : 0),
          potType: pots.indexOf(pot) === 0 ? 'main' : 'side',
        });
      });
    }

    if (winners.length === 0 && playerHands.length > 0) {
      playerHands.sort((a, b) =>
        this.handEvaluator.compareHands(b.handRank, a.handRank),
      );
      winners.push({
        uuid: playerHands[0].uuid,
        amount: state.pot,
        potType: 'main',
      });
    }

    return { winners, playerHands };
  }

  private advancePhase(state: GameState): GameState {
    const newState: GameState = JSON.parse(JSON.stringify(state));

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

  private findHighestVisibleHand(state: GameState): number {
    let highestIndex = 0;
    let highestValue = -1;

    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      if (player.isFolded) continue;

      // Simple evaluation: just sum visible card values for ordering
      const value = player.visibleCards.reduce(
        (sum, c) => sum + RANK_VALUES[c.rank],
        0,
      );

      if (value > highestValue) {
        highestValue = value;
        highestIndex = i;
      }
    }

    return highestIndex;
  }
}
