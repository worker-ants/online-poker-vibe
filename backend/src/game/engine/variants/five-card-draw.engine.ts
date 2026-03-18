import type { IPokerEngine } from '../poker-engine.interface.js';
import type { IGameMode } from '../modes/game-mode.interface.js';
import type {
  GameState,
  PlayerAction,
  PlayerSeat,
  PlayerState,
  HandResult,
  BettingAction,
  DrawPhase,
} from '../../../common/types/game.types.js';
import { Deck } from '../deck.js';
import { HandEvaluator } from '../hand-evaluator.js';
import { BettingRound } from '../betting-round.js';
import { PotCalculator } from '../pot-calculator.js';
import { v4 as uuidv4 } from 'uuid';

export class FiveCardDrawEngine implements IPokerEngine {
  readonly variant = 'five-card-draw' as const;
  private deck = new Deck();
  private handEvaluator = new HandEvaluator();
  private bettingRound = new BettingRound();
  private potCalculator = new PotCalculator();

  initialize(players: PlayerSeat[], mode: IGameMode): GameState {
    return {
      gameId: uuidv4(),
      variant: 'five-card-draw',
      phase: 'deal' as DrawPhase,
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

    // Rotate dealer
    if (newState.handNumber > 1) {
      newState.dealerIndex = this.findNextActive(
        newState.players,
        newState.dealerIndex,
      );
    }

    const numPlayers = newState.players.length;
    if (numPlayers === 2) {
      newState.smallBlindIndex = newState.dealerIndex;
      newState.bigBlindIndex = this.findNextActive(
        newState.players,
        newState.dealerIndex,
      );
    } else {
      newState.smallBlindIndex = this.findNextActive(
        newState.players,
        newState.dealerIndex,
      );
      newState.bigBlindIndex = this.findNextActive(
        newState.players,
        newState.smallBlindIndex,
      );
    }

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

    // Post blinds
    const bigBlind = newState.minRaise;
    const smallBlind = Math.floor(bigBlind / 2);

    const sbPlayer = newState.players[newState.smallBlindIndex];
    const sbAmount = Math.min(smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    newState.pot += sbAmount;
    if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

    const bbPlayer = newState.players[newState.bigBlindIndex];
    const bbAmount = Math.min(bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    newState.pot += bbAmount;
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

    newState.currentBet = bbAmount;

    // Deal 5 cards to each active player
    const deckCards = [...newState.deck];
    for (const player of newState.players) {
      if (!player.isFolded) {
        player.holeCards = deckCards.splice(0, 5);
      }
    }
    newState.deck = deckCards;

    newState.phase = 'first-bet';
    newState.currentPlayerIndex = this.findNextActive(
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
    const phase = state.phase as DrawPhase;

    if (phase === 'draw') {
      return this.handleDraw(state, playerUuid, action);
    }

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
    const phase = state.phase as DrawPhase;

    if (phase === 'draw') {
      // During draw phase, the only action is 'draw' which is handled separately
      return { actions: [], callAmount: 0, minRaise: 0, maxRaise: 0 };
    }

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
      const handRank = this.handEvaluator.evaluate(p.holeCards);
      return { uuid: p.uuid, cards: p.holeCards, handRank };
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

  private handleDraw(
    state: GameState,
    playerUuid: string,
    action: PlayerAction,
  ): GameState {
    const newState: GameState = JSON.parse(JSON.stringify(state));
    const playerIndex = newState.players.findIndex(
      (p) => p.uuid === playerUuid,
    );

    if (playerIndex === -1 || playerIndex !== newState.currentPlayerIndex) {
      throw new Error('현재 턴이 아닙니다.');
    }

    const player = newState.players[playerIndex];
    const discardIndices = action.discardIndices ?? [];

    if (discardIndices.length > 5) {
      throw new Error('최대 5장까지 교환 가능합니다.');
    }

    // Validate indices
    for (const idx of discardIndices) {
      if (idx < 0 || idx >= player.holeCards.length) {
        throw new Error('잘못된 카드 인덱스입니다.');
      }
    }

    // Remove discarded cards and draw new ones
    const deckCards = [...newState.deck];
    const discarded: any[] = [];

    // Remove in reverse order to maintain indices
    const sortedIndices = [...discardIndices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      discarded.push(player.holeCards.splice(idx, 1)[0]);
    }

    // If not enough cards in deck, shuffle discards back
    if (deckCards.length < discardIndices.length) {
      // Shuffle discards from other players back into deck
      // (simplified: just shuffle the discarded cards back)
      deckCards.push(...discarded);
      // Fisher-Yates shuffle
      for (let i = deckCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckCards[i], deckCards[j]] = [deckCards[j], deckCards[i]];
      }
    }

    // Draw new cards
    const newCards = deckCards.splice(0, discardIndices.length);
    player.holeCards.push(...newCards);

    newState.deck = deckCards;
    player.hasActed = true;

    // Record action
    newState.roundHistory.push({
      playerUuid,
      action,
      timestamp: Date.now(),
    });

    // Move to next player for draw
    const nextPlayer = this.findNextDrawPlayer(newState, playerIndex);
    if (nextPlayer === -1) {
      // All players have drawn, advance to second betting round
      newState.phase = 'second-bet';
      newState.currentBet = 0;
      newState.players.forEach((p) => {
        p.currentBet = 0;
        p.hasActed = false;
      });
      newState.currentPlayerIndex = this.findNextActive(
        newState.players,
        newState.dealerIndex,
      );
    } else {
      newState.currentPlayerIndex = nextPlayer;
    }

    return newState;
  }

  private advancePhase(state: GameState): GameState {
    const newState: GameState = JSON.parse(JSON.stringify(state));

    if (this.bettingRound.isOnlyOnePlayerRemaining(newState)) {
      newState.phase = 'showdown';
      return newState;
    }

    const phase = newState.phase as DrawPhase;

    switch (phase) {
      case 'first-bet':
        // Move to draw phase
        newState.phase = 'draw';
        newState.players.forEach((p) => {
          p.hasActed = false;
        });
        newState.currentPlayerIndex = this.findNextActive(
          newState.players,
          newState.dealerIndex,
        );
        break;

      case 'second-bet':
        newState.phase = 'showdown';
        break;

      default:
        break;
    }

    return newState;
  }

  private findNextDrawPlayer(state: GameState, fromIndex: number): number {
    const numPlayers = state.players.length;
    for (let i = 1; i <= numPlayers; i++) {
      const idx = (fromIndex + i) % numPlayers;
      const player = state.players[idx];
      if (!player.isFolded && !player.isAllIn && !player.hasActed) {
        return idx;
      }
    }
    return -1;
  }

  private findNextActive(players: PlayerState[], fromIndex: number): number {
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
