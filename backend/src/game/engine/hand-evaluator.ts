import type { Card, Rank } from '../../common/types/card.types.js';
import { RANK_VALUES } from '../../common/types/card.types.js';
import {
  HandCategory,
  HAND_CATEGORY_RANKS,
} from '../../common/types/game.types.js';
import type { HandRank } from '../../common/types/game.types.js';

export class HandEvaluator {
  /**
   * Evaluate the best 5-card hand from any number of cards.
   * For Hold'em: pass 7 cards (2 hole + 5 community)
   * For Draw: pass 5 cards
   * For Stud: pass 7 cards
   */
  evaluate(cards: Card[]): HandRank {
    if (cards.length < 5) {
      throw new Error(
        `최소 5장의 카드가 필요합니다. 받은 카드: ${cards.length}장`,
      );
    }

    if (cards.length === 5) {
      return this.evaluateFive(cards);
    }

    // Find best 5-card combination
    const combinations = this.getCombinations(cards, 5);
    let bestHand: HandRank | null = null;

    for (const combo of combinations) {
      const hand = this.evaluateFive(combo);
      if (!bestHand || this.compareHands(hand, bestHand) > 0) {
        bestHand = hand;
      }
    }

    return bestHand!;
  }

  /**
   * Compare two hands. Returns positive if a > b, negative if a < b, 0 if equal.
   */
  compareHands(a: HandRank, b: HandRank): number {
    if (a.categoryRank !== b.categoryRank) {
      return a.categoryRank - b.categoryRank;
    }

    // Compare kicker values
    for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
      if (a.values[i] !== b.values[i]) {
        return a.values[i] - b.values[i];
      }
    }

    return 0;
  }

  private evaluateFive(cards: Card[]): HandRank {
    const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
    const suits = cards.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);
    const isStraight = this.isStraight(values);
    const isWheel = this.isWheel(values);

    // Count occurrences of each rank value
    const counts = new Map<number, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const countEntries = [...counts.entries()].sort((a, b) => {
      // Sort by count desc, then by value desc
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

    const countPattern = countEntries.map(([, c]) => c).join('');

    // Royal Flush
    if (isFlush && isStraight && values[0] === 14) {
      return {
        category: HandCategory.RoyalFlush,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.RoyalFlush],
        values: [14],
        description: 'Royal Flush',
      };
    }

    // Straight Flush
    if (isFlush && (isStraight || isWheel)) {
      const highCard = isWheel ? 5 : values[0];
      return {
        category: HandCategory.StraightFlush,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.StraightFlush],
        values: [highCard],
        description: `Straight Flush, ${this.rankName(highCard)} high`,
      };
    }

    // Four of a Kind
    if (countPattern === '41') {
      return {
        category: HandCategory.FourOfAKind,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.FourOfAKind],
        values: [countEntries[0][0], countEntries[1][0]],
        description: `Four of a Kind, ${this.rankName(countEntries[0][0])}s`,
      };
    }

    // Full House
    if (countPattern === '32') {
      return {
        category: HandCategory.FullHouse,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.FullHouse],
        values: [countEntries[0][0], countEntries[1][0]],
        description: `Full House, ${this.rankName(countEntries[0][0])}s full of ${this.rankName(countEntries[1][0])}s`,
      };
    }

    // Flush
    if (isFlush) {
      return {
        category: HandCategory.Flush,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.Flush],
        values,
        description: `Flush, ${this.rankName(values[0])} high`,
      };
    }

    // Straight
    if (isStraight || isWheel) {
      const highCard = isWheel ? 5 : values[0];
      return {
        category: HandCategory.Straight,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.Straight],
        values: [highCard],
        description: `Straight, ${this.rankName(highCard)} high`,
      };
    }

    // Three of a Kind
    if (countPattern === '311') {
      const kickers = countEntries
        .filter(([, c]) => c === 1)
        .map(([v]) => v)
        .sort((a, b) => b - a);
      return {
        category: HandCategory.ThreeOfAKind,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.ThreeOfAKind],
        values: [countEntries[0][0], ...kickers],
        description: `Three of a Kind, ${this.rankName(countEntries[0][0])}s`,
      };
    }

    // Two Pair
    if (countPattern === '221') {
      const pairs = countEntries
        .filter(([, c]) => c === 2)
        .map(([v]) => v)
        .sort((a, b) => b - a);
      const kicker = countEntries.find(([, c]) => c === 1)![0];
      return {
        category: HandCategory.TwoPair,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.TwoPair],
        values: [...pairs, kicker],
        description: `Two Pair, ${this.rankName(pairs[0])}s and ${this.rankName(pairs[1])}s`,
      };
    }

    // One Pair
    if (countPattern === '2111') {
      const kickers = countEntries
        .filter(([, c]) => c === 1)
        .map(([v]) => v)
        .sort((a, b) => b - a);
      return {
        category: HandCategory.OnePair,
        categoryRank: HAND_CATEGORY_RANKS[HandCategory.OnePair],
        values: [countEntries[0][0], ...kickers],
        description: `One Pair, ${this.rankName(countEntries[0][0])}s`,
      };
    }

    // High Card
    return {
      category: HandCategory.HighCard,
      categoryRank: HAND_CATEGORY_RANKS[HandCategory.HighCard],
      values,
      description: `High Card, ${this.rankName(values[0])}`,
    };
  }

  private isStraight(sortedValues: number[]): boolean {
    for (let i = 0; i < sortedValues.length - 1; i++) {
      if (sortedValues[i] - sortedValues[i + 1] !== 1) return false;
    }
    return true;
  }

  private isWheel(sortedValues: number[]): boolean {
    // A-2-3-4-5 (Ace low straight)
    return (
      sortedValues[0] === 14 &&
      sortedValues[1] === 5 &&
      sortedValues[2] === 4 &&
      sortedValues[3] === 3 &&
      sortedValues[4] === 2
    );
  }

  private getCombinations(cards: Card[], k: number): Card[][] {
    const result: Card[][] = [];

    function combine(start: number, current: Card[]) {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      for (let i = start; i < cards.length; i++) {
        current.push(cards[i]);
        combine(i + 1, current);
        current.pop();
      }
    }

    combine(0, []);
    return result;
  }

  private rankName(value: number): string {
    const names: Record<number, string> = {
      2: 'Two',
      3: 'Three',
      4: 'Four',
      5: 'Five',
      6: 'Six',
      7: 'Seven',
      8: 'Eight',
      9: 'Nine',
      10: 'Ten',
      11: 'Jack',
      12: 'Queen',
      13: 'King',
      14: 'Ace',
    };
    return names[value] ?? String(value);
  }
}
