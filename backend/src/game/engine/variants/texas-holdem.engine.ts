import type { IPokerEngine } from '../poker-engine.interface.js';
import type { IGameMode } from '../modes/game-mode.interface.js';
import type {
  GameState,
  PlayerAction,
  PlayerSeat,
  PlayerState,
  HandResult,
  BettingAction,
  HoldemPhase,
} from '../../../common/types/game.types.js';
import { Deck } from '../deck.js';
import { HandEvaluator } from '../hand-evaluator.js';
import { BettingRound } from '../betting-round.js';
import { PotCalculator } from '../pot-calculator.js';
import { v4 as uuidv4 } from 'uuid';

export class TexasHoldemEngine implements IPokerEngine {
  readonly variant = 'texas-holdem' as const;
  private deck = new Deck();
  private handEvaluator = new HandEvaluator();
  private bettingRound = new BettingRound();
  private potCalculator = new PotCalculator();

  initialize(players: PlayerSeat[], mode: IGameMode): GameState {
    return {
      gameId: uuidv4(),
      variant: 'texas-holdem',
      phase: 'deal' as HoldemPhase,
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
      smallBlindIndex: 1 % players.length,
      bigBlindIndex: 2 % players.length,
      currentBet: 0,
      minRaise: mode.getBigBlind(1),
      roundHistory: [],
      handNumber: 0,
    };
  }

  startHand(state: GameState): GameState {
    const newState: GameState = JSON.parse(JSON.stringify(state));
    newState.handNumber++;

    // Reset player state for new hand
    const activePlayers = newState.players.filter((p) => p.chips > 0);
    if (activePlayers.length < 2) {
      throw new Error('게임을 시작하기 위한 플레이어가 부족합니다.');
    }

    // Rotate dealer
    if (newState.handNumber > 1) {
      newState.dealerIndex = this.findNextActivePlayerIndex(
        newState.players,
        newState.dealerIndex,
      );
    }

    const numPlayers = newState.players.length;

    // Set blinds based on player count
    if (numPlayers === 2) {
      // Heads-up: dealer is small blind
      newState.smallBlindIndex = newState.dealerIndex;
      newState.bigBlindIndex = this.findNextActivePlayerIndex(
        newState.players,
        newState.dealerIndex,
      );
    } else {
      newState.smallBlindIndex = this.findNextActivePlayerIndex(
        newState.players,
        newState.dealerIndex,
      );
      newState.bigBlindIndex = this.findNextActivePlayerIndex(
        newState.players,
        newState.smallBlindIndex,
      );
    }

    // Reset all players for new hand
    newState.players.forEach((p) => {
      p.currentBet = 0;
      p.holeCards = [];
      p.visibleCards = [];
      p.isFolded = p.chips <= 0; // Eliminated players stay folded
      p.isAllIn = false;
      p.hasActed = false;
    });

    newState.pot = 0;
    newState.sidePots = [];
    newState.communityCards = [];
    newState.currentBet = 0;
    newState.roundHistory = [];

    // Create and shuffle deck
    this.deck.reset();
    this.deck.shuffle();
    newState.deck = this.deck.getCards();

    // Post blinds
    const sbPlayer = newState.players[newState.smallBlindIndex];
    const bbPlayer = newState.players[newState.bigBlindIndex];

    // Get blind amounts from mode context (stored in minRaise we'll set)
    // We need mode info - for now use minRaise as bigBlind indicator
    const bigBlind = newState.minRaise;
    const smallBlind = Math.floor(bigBlind / 2);

    const sbAmount = Math.min(smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    newState.pot += sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    const bbAmount = Math.min(bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    newState.pot += bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    newState.currentBet = bbAmount;

    // Deal 2 hole cards to each active player
    const deckCards = [...newState.deck];
    for (const player of newState.players) {
      if (!player.isFolded) {
        player.holeCards = deckCards.splice(0, 2);
      }
    }
    newState.deck = deckCards;

    // Set phase to pre-flop
    newState.phase = 'pre-flop';

    // First to act: player after big blind (UTG)
    newState.currentPlayerIndex = this.findNextActivePlayerIndex(
      newState.players,
      newState.bigBlindIndex,
    );

    return newState;
  }

  handleAction(
    state: GameState,
    playerUuid: string,
    action: PlayerAction,
  ): GameState {
    let newState = this.bettingRound.applyAction(state, playerUuid, action);

    // Check if betting round is complete
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

    // If only one player remains, they win everything
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

    // Evaluate hands
    const playerHands = activePlayers.map((p) => {
      const allCards = [...p.holeCards, ...state.communityCards];
      const handRank = this.handEvaluator.evaluate(allCards);
      return {
        uuid: p.uuid,
        cards: p.holeCards,
        handRank,
      };
    });

    // Calculate pots
    const pots = this.potCalculator.calculatePots(state.players);

    const winners: HandResult['winners'] = [];

    for (const pot of pots) {
      // Find eligible players with best hand
      const eligibleHands = playerHands.filter((ph) =>
        pot.playerUuids.includes(ph.uuid),
      );

      if (eligibleHands.length === 0) continue;

      // Sort by hand rank (best first)
      eligibleHands.sort((a, b) =>
        this.handEvaluator.compareHands(b.handRank, a.handRank),
      );

      // Find all players with the best hand (ties)
      const bestHand = eligibleHands[0].handRank;
      const tiedPlayers = eligibleHands.filter(
        (ph) => this.handEvaluator.compareHands(ph.handRank, bestHand) === 0,
      );

      // Split pot among tied players
      const share = Math.floor(pot.amount / tiedPlayers.length);
      const remainder = pot.amount % tiedPlayers.length;

      tiedPlayers.forEach((ph, i) => {
        winners.push({
          uuid: ph.uuid,
          amount: share + (i === 0 ? remainder : 0),
          potType: pots.indexOf(pot) === 0 ? 'main' : 'side',
        });
      });
    }

    // If no pots were calculated, give everything to best hand
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

    // If only one player left, go to showdown
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

    switch (newState.phase as HoldemPhase) {
      case 'pre-flop':
        // Deal flop (3 community cards)
        deckCards.splice(0, 1); // Burn card
        newState.communityCards = deckCards.splice(0, 3);
        newState.phase = 'flop';
        break;

      case 'flop':
        // Deal turn (1 community card)
        deckCards.splice(0, 1); // Burn card
        newState.communityCards.push(...deckCards.splice(0, 1));
        newState.phase = 'turn';
        break;

      case 'turn':
        // Deal river (1 community card)
        deckCards.splice(0, 1); // Burn card
        newState.communityCards.push(...deckCards.splice(0, 1));
        newState.phase = 'river';
        break;

      case 'river':
        newState.phase = 'showdown';
        newState.deck = deckCards;
        return newState;

      default:
        break;
    }

    newState.deck = deckCards;

    // First to act after pre-flop: small blind or next active player
    newState.currentPlayerIndex = this.findNextActivePlayerIndex(
      newState.players,
      newState.dealerIndex,
    );

    // If all remaining players are all-in, auto-advance
    const canAct = newState.players.filter((p) => !p.isFolded && !p.isAllIn);
    if (canAct.length <= 1) {
      return this.advancePhase(newState);
    }

    return newState;
  }

  private findNextActivePlayerIndex(
    players: PlayerState[],
    fromIndex: number,
  ): number {
    const numPlayers = players.length;
    for (let i = 1; i <= numPlayers; i++) {
      const idx = (fromIndex + i) % numPlayers;
      if (!players[idx].isFolded && players[idx].chips > 0) {
        return idx;
      }
    }
    return fromIndex;
  }
}
