import { randomInt } from 'crypto';
import { SUITS, RANKS } from '../../common/types/card.types.js';
import type { Card } from '../../common/types/card.types.js';

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = [];
    this.reset();
  }

  reset(): void {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ suit, rank });
      }
    }
  }

  shuffle(): void {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count: number): Card[] {
    if (count > this.cards.length) {
      throw new Error(
        `덱에 카드가 부족합니다. 요청: ${count}, 남은 카드: ${this.cards.length}`,
      );
    }
    return this.cards.splice(0, count);
  }

  dealOne(): Card {
    return this.deal(1)[0];
  }

  remaining(): number {
    return this.cards.length;
  }

  addCards(cards: Card[]): void {
    this.cards.push(...cards);
  }

  getCards(): Card[] {
    return [...this.cards];
  }
}
