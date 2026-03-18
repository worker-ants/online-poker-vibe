import { HandEvaluator } from './hand-evaluator.js';
import { HandCategory } from '../../common/types/game.types.js';
import type { Card } from '../../common/types/card.types.js';

describe('HandEvaluator', () => {
  const evaluator = new HandEvaluator();

  function makeCards(...specs: string[]): Card[] {
    return specs.map((s) => {
      const suitMap: Record<string, Card['suit']> = {
        h: 'hearts',
        d: 'diamonds',
        c: 'clubs',
        s: 'spades',
      };
      const suit = suitMap[s.slice(-1)];
      const rank = s.slice(0, -1) as Card['rank'];
      return { suit, rank };
    });
  }

  describe('5-card hands', () => {
    it('should detect Royal Flush', () => {
      const cards = makeCards('As', 'Ks', 'Qs', 'Js', '10s');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.RoyalFlush);
    });

    it('should detect Straight Flush', () => {
      const cards = makeCards('9h', '8h', '7h', '6h', '5h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.StraightFlush);
      expect(result.values[0]).toBe(9);
    });

    it('should detect Wheel Straight Flush (A-2-3-4-5)', () => {
      const cards = makeCards('Ac', '2c', '3c', '4c', '5c');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.StraightFlush);
      expect(result.values[0]).toBe(5);
    });

    it('should detect Four of a Kind', () => {
      const cards = makeCards('Kh', 'Kd', 'Kc', 'Ks', '3h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.FourOfAKind);
    });

    it('should detect Full House', () => {
      const cards = makeCards('Qh', 'Qd', 'Qc', '7s', '7h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.FullHouse);
    });

    it('should detect Flush', () => {
      const cards = makeCards('Ah', 'Jh', '8h', '5h', '2h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.Flush);
    });

    it('should detect Straight', () => {
      const cards = makeCards('10h', '9d', '8c', '7s', '6h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.Straight);
      expect(result.values[0]).toBe(10);
    });

    it('should detect Wheel Straight (A-2-3-4-5)', () => {
      const cards = makeCards('Ah', '2d', '3c', '4s', '5h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.Straight);
      expect(result.values[0]).toBe(5);
    });

    it('should detect Three of a Kind', () => {
      const cards = makeCards('8h', '8d', '8c', 'Ks', '3h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.ThreeOfAKind);
    });

    it('should detect Two Pair', () => {
      const cards = makeCards('Jh', 'Jd', '5c', '5s', '2h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.TwoPair);
    });

    it('should detect One Pair', () => {
      const cards = makeCards('Ah', 'Ad', 'Kc', '7s', '3h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.OnePair);
    });

    it('should detect High Card', () => {
      const cards = makeCards('Ah', 'Jd', '8c', '5s', '2h');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.HighCard);
    });
  });

  describe("7-card hands (Hold'em / Stud)", () => {
    it('should find best 5-card hand from 7 cards', () => {
      // Royal flush hidden in 7 cards
      const cards = makeCards('As', 'Ks', 'Qs', 'Js', '10s', '2h', '3d');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.RoyalFlush);
    });

    it('should find Full House from 7 cards with two pair + three', () => {
      const cards = makeCards('Kh', 'Kd', 'Kc', '7s', '7h', '3d', '2c');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.FullHouse);
    });

    it('should find Flush from 7 cards', () => {
      const cards = makeCards('Ah', 'Kh', '9h', '5h', '2h', 'Jd', '3c');
      const result = evaluator.evaluate(cards);
      expect(result.category).toBe(HandCategory.Flush);
    });
  });

  describe('hand comparison', () => {
    it('should rank Royal Flush higher than Straight Flush', () => {
      const royal = evaluator.evaluate(
        makeCards('As', 'Ks', 'Qs', 'Js', '10s'),
      );
      const straight = evaluator.evaluate(
        makeCards('9h', '8h', '7h', '6h', '5h'),
      );
      expect(evaluator.compareHands(royal, straight)).toBeGreaterThan(0);
    });

    it('should compare same category by kicker', () => {
      const pairAces = evaluator.evaluate(
        makeCards('Ah', 'Ad', 'Kc', '7s', '3h'),
      );
      const pairKings = evaluator.evaluate(
        makeCards('Kh', 'Kd', 'Ac', '7s', '3h'),
      );
      expect(evaluator.compareHands(pairAces, pairKings)).toBeGreaterThan(0);
    });

    it('should return 0 for equal hands', () => {
      const hand1 = evaluator.evaluate(makeCards('Ah', 'Kd', 'Qc', 'Js', '9h'));
      const hand2 = evaluator.evaluate(makeCards('As', 'Kc', 'Qh', 'Jd', '9s'));
      expect(evaluator.compareHands(hand1, hand2)).toBe(0);
    });

    it('should compare Two Pair by higher pair first', () => {
      const acesAndTwos = evaluator.evaluate(
        makeCards('Ah', 'Ad', '2c', '2s', 'Kh'),
      );
      const kingsAndQueens = evaluator.evaluate(
        makeCards('Kh', 'Kd', 'Qc', 'Qs', '3h'),
      );
      expect(
        evaluator.compareHands(acesAndTwos, kingsAndQueens),
      ).toBeGreaterThan(0);
    });
  });

  it('should throw for fewer than 5 cards', () => {
    const cards = makeCards('Ah', 'Kd', 'Qc', 'Js');
    expect(() => evaluator.evaluate(cards)).toThrow('최소 5장');
  });
});
