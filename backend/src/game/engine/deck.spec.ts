import { Deck } from './deck.js';

describe('Deck', () => {
  let deck: Deck;

  beforeEach(() => {
    deck = new Deck();
  });

  it('should have 52 cards after creation', () => {
    expect(deck.remaining()).toBe(52);
  });

  it('should deal the requested number of cards', () => {
    const cards = deck.deal(5);
    expect(cards).toHaveLength(5);
    expect(deck.remaining()).toBe(47);
  });

  it('should deal one card with dealOne', () => {
    const card = deck.dealOne();
    expect(card).toBeDefined();
    expect(card.suit).toBeDefined();
    expect(card.rank).toBeDefined();
    expect(deck.remaining()).toBe(51);
  });

  it('should throw when dealing more cards than available', () => {
    deck.deal(50);
    expect(() => deck.deal(5)).toThrow('덱에 카드가 부족합니다');
  });

  it('should have all unique cards', () => {
    const cards = deck.deal(52);
    const keys = cards.map((c) => `${c.suit}-${c.rank}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(52);
  });

  it('should shuffle and produce different order', () => {
    const deck1 = new Deck();
    const deck2 = new Deck();
    deck2.shuffle();

    const cards1 = deck1.getCards();
    const cards2 = deck2.getCards();

    // Very unlikely to be the same after shuffle
    const sameOrder = cards1.every(
      (c, i) => c.suit === cards2[i].suit && c.rank === cards2[i].rank,
    );
    expect(sameOrder).toBe(false);
  });

  it('should reset to 52 cards', () => {
    deck.deal(10);
    expect(deck.remaining()).toBe(42);
    deck.reset();
    expect(deck.remaining()).toBe(52);
  });

  it('should add cards back to deck', () => {
    const cards = deck.deal(5);
    deck.addCards(cards);
    expect(deck.remaining()).toBe(52);
  });
});
