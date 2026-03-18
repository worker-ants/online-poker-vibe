import { Injectable } from '@nestjs/common';
import { HandEvaluator } from '../game/engine/hand-evaluator.js';
import { RANK_VALUES } from '../common/types/card.types.js';
import { AI_NAMES, AI_UUID_PREFIX } from './ai-names.js';
import type { Card } from '../common/types/card.types.js';
import {
  HAND_CATEGORY_RANKS,
  HandCategory,
  type GameState,
  type PlayerAction,
  type PlayerSeat,
  type BettingAction,
  type PokerVariant,
} from '../common/types/game.types.js';

interface ValidActions {
  actions: BettingAction[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
}

@Injectable()
export class AiPlayerService {
  private handEvaluator = new HandEvaluator();

  createAiPlayers(count: number, occupiedSeats: Set<number>): PlayerSeat[] {
    const aiPlayers: PlayerSeat[] = [];
    let seatIndex = 0;
    for (let i = 0; i < count; i++) {
      while (occupiedSeats.has(seatIndex)) {
        seatIndex++;
      }
      aiPlayers.push({
        uuid: `${AI_UUID_PREFIX}${i + 1}`,
        nickname: `[AI] ${AI_NAMES[i % AI_NAMES.length]}`,
        seatIndex,
        chips: 0, // Will be set by game engine
      });
      occupiedSeats.add(seatIndex);
      seatIndex++;
    }
    return aiPlayers;
  }

  decideAction(
    gameState: GameState,
    playerUuid: string,
    validActions: ValidActions,
    variant: PokerVariant,
  ): PlayerAction {
    const player = gameState.players.find((p) => p.uuid === playerUuid);
    if (!player) {
      return { type: 'fold' };
    }

    // Handle Five Card Draw draw phase
    if (gameState.phase === 'draw' && variant === 'five-card-draw') {
      return this.decideDrawAction(player.holeCards);
    }

    const { actions, callAmount, minRaise, maxRaise } = validActions;

    if (actions.length === 0) {
      return { type: 'fold' };
    }

    const handScore = this.evaluateHandStrength(
      player.holeCards,
      gameState.communityCards,
      player.visibleCards,
      variant,
      gameState.phase,
    );

    const pot = gameState.pot;
    const potOdds = callAmount > 0 ? callAmount / (pot + callAmount) : 0;
    const isProfitable = handScore > potOdds * 1.5;

    const bluffRoll = Math.random();

    // Very strong hand (>= 0.8): raise aggressively
    if (handScore >= 0.8) {
      if (actions.includes('raise')) {
        const raiseAmount = Math.min(Math.max(minRaise, pot), maxRaise);
        return { type: 'raise', amount: raiseAmount };
      }
      if (actions.includes('call')) return { type: 'call' };
      if (actions.includes('check')) return { type: 'check' };
    }

    // Strong hand (>= 0.6): raise small or call
    if (handScore >= 0.6) {
      if (actions.includes('raise') && Math.random() > 0.4) {
        const raiseAmount = Math.min(minRaise, maxRaise);
        return { type: 'raise', amount: raiseAmount };
      }
      if (actions.includes('call')) return { type: 'call' };
      if (actions.includes('check')) return { type: 'check' };
    }

    // Medium hand (>= 0.4): call if profitable
    if (handScore >= 0.4) {
      if (isProfitable) {
        if (actions.includes('call')) return { type: 'call' };
        if (actions.includes('check')) return { type: 'check' };
      }
      if (actions.includes('check')) return { type: 'check' };
      // Bluff 10%
      if (bluffRoll < 0.1 && actions.includes('raise')) {
        return { type: 'raise', amount: Math.min(minRaise, maxRaise) };
      }
      return { type: 'fold' };
    }

    // Weak hand (>= 0.2): mostly fold
    if (handScore >= 0.2) {
      if (actions.includes('check')) return { type: 'check' };
      // Bluff 10%
      if (bluffRoll < 0.1 && actions.includes('raise')) {
        return { type: 'raise', amount: Math.min(minRaise, maxRaise) };
      }
      if (isProfitable && actions.includes('call')) return { type: 'call' };
      return { type: 'fold' };
    }

    // Trash hand (< 0.2): fold
    if (actions.includes('check')) return { type: 'check' };
    // Bluff 5%
    if (bluffRoll < 0.05 && actions.includes('raise')) {
      return { type: 'raise', amount: Math.min(minRaise, maxRaise) };
    }
    return { type: 'fold' };
  }

  evaluateHandStrength(
    holeCards: Card[],
    communityCards: Card[],
    visibleCards: Card[],
    variant: PokerVariant,
    phase: string,
  ): number {
    // Pre-flop Texas Hold'em: use lookup table
    if (
      variant === 'texas-holdem' &&
      phase === 'pre-flop' &&
      holeCards.length === 2
    ) {
      return this.preFlopStrength(holeCards);
    }

    // Collect available cards for evaluation
    let evalCards: Card[];
    if (variant === 'seven-card-stud') {
      evalCards = [...holeCards, ...visibleCards];
    } else {
      evalCards = [...holeCards, ...communityCards];
    }

    // Need at least 5 cards to evaluate
    if (evalCards.length < 5) {
      // For pre-flop or early phases with few cards, use basic card ranking
      return this.basicCardStrength(holeCards);
    }

    const handRank = this.handEvaluator.evaluate(evalCards);

    // Map hand category to AI strength score (0.1-1.0)
    const strengthScores: Record<number, number> = {
      [HAND_CATEGORY_RANKS[HandCategory.HighCard]]: 0.1,
      [HAND_CATEGORY_RANKS[HandCategory.OnePair]]: 0.3,
      [HAND_CATEGORY_RANKS[HandCategory.TwoPair]]: 0.5,
      [HAND_CATEGORY_RANKS[HandCategory.ThreeOfAKind]]: 0.6,
      [HAND_CATEGORY_RANKS[HandCategory.Straight]]: 0.7,
      [HAND_CATEGORY_RANKS[HandCategory.Flush]]: 0.75,
      [HAND_CATEGORY_RANKS[HandCategory.FullHouse]]: 0.85,
      [HAND_CATEGORY_RANKS[HandCategory.FourOfAKind]]: 0.95,
      [HAND_CATEGORY_RANKS[HandCategory.StraightFlush]]: 0.98,
      [HAND_CATEGORY_RANKS[HandCategory.RoyalFlush]]: 1.0,
    };

    return strengthScores[handRank.categoryRank] ?? 0.1;
  }

  private preFlopStrength(holeCards: Card[]): number {
    const v1 = RANK_VALUES[holeCards[0].rank];
    const v2 = RANK_VALUES[holeCards[1].rank];
    const high = Math.max(v1, v2);
    const low = Math.min(v1, v2);
    const suited = holeCards[0].suit === holeCards[1].suit;
    const isPair = v1 === v2;

    // Pocket pairs
    if (isPair) {
      // AA=1.0, KK=0.95, ... 22=0.5
      return 0.5 + ((high - 2) / 12) * 0.5;
    }

    // Base score from card values
    const baseScore = (high + low - 4) / 24; // Normalize 0-1

    // Bonus for suited
    const suitedBonus = suited ? 0.05 : 0;

    // Bonus for connectedness
    const gap = high - low;
    const connectorBonus = gap === 1 ? 0.05 : gap === 2 ? 0.03 : 0;

    // Premium hands bonus
    let premiumBonus = 0;
    if (high === 14) {
      // Ace-high
      premiumBonus = low >= 10 ? 0.15 : 0.05;
    } else if (high >= 12 && low >= 10) {
      premiumBonus = 0.1;
    }

    return Math.min(
      baseScore + suitedBonus + connectorBonus + premiumBonus,
      0.95,
    );
  }

  private basicCardStrength(cards: Card[]): number {
    if (cards.length === 0) return 0.1;
    const values = cards.map((c) => RANK_VALUES[c.rank]);
    const maxVal = Math.max(...values);
    // Simple normalize: 2=0.1, A=0.5
    return 0.1 + ((maxVal - 2) / 12) * 0.4;
  }

  private decideDrawAction(holeCards: Card[]): PlayerAction {
    const discardIndices = this.getDiscardIndices(holeCards);
    return { type: 'draw', discardIndices };
  }

  getDiscardIndices(holeCards: Card[]): number[] {
    const values = holeCards.map((c) => RANK_VALUES[c.rank]);
    const suits = holeCards.map((c) => c.suit);

    // Count value occurrences
    const valueCounts = new Map<number, number[]>();
    values.forEach((v, i) => {
      const indices = valueCounts.get(v) ?? [];
      indices.push(i);
      valueCounts.set(v, indices);
    });

    // Keep pairs/trips/quads
    const keepIndices = new Set<number>();
    for (const [, indices] of valueCounts) {
      if (indices.length >= 2) {
        indices.forEach((i) => keepIndices.add(i));
      }
    }

    // If keeping something, discard the rest
    if (keepIndices.size > 0) {
      return holeCards.map((_, i) => i).filter((i) => !keepIndices.has(i));
    }

    // Check for 4-card flush
    const suitCounts = new Map<string, number[]>();
    suits.forEach((s, i) => {
      const indices = suitCounts.get(s) ?? [];
      indices.push(i);
      suitCounts.set(s, indices);
    });

    for (const [, indices] of suitCounts) {
      if (indices.length >= 4) {
        const flushSet = new Set(indices);
        return holeCards.map((_, i) => i).filter((i) => !flushSet.has(i));
      }
    }

    // Check for 4-card straight
    const sortedWithIndex = values
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v);
    for (let start = 0; start <= sortedWithIndex.length - 4; start++) {
      const slice = sortedWithIndex.slice(start, start + 4);
      const isSequential =
        slice[3].v - slice[0].v === 3 &&
        new Set(slice.map((s) => s.v)).size === 4;
      if (isSequential) {
        const straightSet = new Set(slice.map((s) => s.i));
        return holeCards.map((_, i) => i).filter((i) => !straightSet.has(i));
      }
    }

    // Keep highest card, discard rest
    const highestIndex = values.indexOf(Math.max(...values));
    return holeCards.map((_, i) => i).filter((i) => i !== highestIndex);
  }
}
