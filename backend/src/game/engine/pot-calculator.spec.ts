import { PotCalculator } from './pot-calculator.js';
import type { PlayerState } from '../../common/types/game.types.js';

function makePlayer(
  overrides: Partial<PlayerState> & { uuid: string },
): PlayerState {
  return {
    nickname: overrides.uuid,
    seatIndex: 0,
    chips: 1000,
    currentBet: 0,
    holeCards: [],
    visibleCards: [],
    isFolded: false,
    isAllIn: false,
    isDisconnected: false,
    hasActed: false,
    ...overrides,
  };
}

describe('PotCalculator', () => {
  let calculator: PotCalculator;

  beforeEach(() => {
    calculator = new PotCalculator();
  });

  describe('calculatePots', () => {
    it('should create a single pot when no player is all-in', () => {
      const players = [
        makePlayer({ uuid: 'p1', seatIndex: 0, currentBet: 100, chips: 900 }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100, chips: 900 }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 100, chips: 900 }),
      ];

      const pots = calculator.calculatePots(players);

      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(300);
      expect(pots[0].playerUuids).toEqual(
        expect.arrayContaining(['p1', 'p2', 'p3']),
      );
    });

    it('should create main pot and side pot when one player is all-in for less', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 50,
          chips: 0,
          isAllIn: true,
        }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100, chips: 900 }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 100, chips: 900 }),
      ];

      const pots = calculator.calculatePots(players);

      expect(pots).toHaveLength(2);
      // Main pot: 50 * 3 = 150, all three eligible
      expect(pots[0].amount).toBe(150);
      expect(pots[0].playerUuids).toEqual(
        expect.arrayContaining(['p1', 'p2', 'p3']),
      );
      // Side pot: 50 * 2 = 100, only p2 and p3 eligible
      expect(pots[1].amount).toBe(100);
      expect(pots[1].playerUuids).toEqual(expect.arrayContaining(['p2', 'p3']));
      expect(pots[1].playerUuids).not.toContain('p1');
    });

    it('should create multiple side pots with multiple all-ins at different levels', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 30,
          chips: 0,
          isAllIn: true,
        }),
        makePlayer({
          uuid: 'p2',
          seatIndex: 1,
          currentBet: 60,
          chips: 0,
          isAllIn: true,
        }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 100, chips: 900 }),
      ];

      const pots = calculator.calculatePots(players);

      expect(pots).toHaveLength(3);
      // Main pot: 30 * 3 = 90, all three eligible
      expect(pots[0].amount).toBe(90);
      expect(pots[0].playerUuids).toEqual(
        expect.arrayContaining(['p1', 'p2', 'p3']),
      );
      // Side pot 1: 30 * 2 = 60, p2 and p3 eligible
      expect(pots[1].amount).toBe(60);
      expect(pots[1].playerUuids).toEqual(expect.arrayContaining(['p2', 'p3']));
      expect(pots[1].playerUuids).not.toContain('p1');
      // Side pot 2: 40 * 1 = 40, only p3 eligible
      expect(pots[2].amount).toBe(40);
      expect(pots[2].playerUuids).toEqual(['p3']);
    });

    it('should include folded player contributions in pot but not make them eligible', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 50,
          chips: 950,
          isFolded: true,
        }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100, chips: 900 }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 100, chips: 900 }),
      ];

      const pots = calculator.calculatePots(players);

      // Total should be 250 (50 + 100 + 100)
      const totalPotAmount = pots.reduce((sum, p) => sum + p.amount, 0);
      expect(totalPotAmount).toBe(250);

      // p1 should not be eligible for any pot
      for (const pot of pots) {
        expect(pot.playerUuids).not.toContain('p1');
      }

      // p2 and p3 should be eligible
      const allEligible = pots.flatMap((p) => p.playerUuids);
      expect(allEligible).toContain('p2');
      expect(allEligible).toContain('p3');
    });

    it('should return empty array when no active players', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 50,
          isFolded: true,
        }),
        makePlayer({
          uuid: 'p2',
          seatIndex: 1,
          currentBet: 50,
          isFolded: true,
        }),
      ];

      const pots = calculator.calculatePots(players);

      expect(pots).toEqual([]);
    });

    it('should return single pot when all players fold except one', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 50,
          isFolded: true,
        }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100, chips: 900 }),
        makePlayer({
          uuid: 'p3',
          seatIndex: 2,
          currentBet: 50,
          isFolded: true,
        }),
      ];

      const pots = calculator.calculatePots(players);

      const totalPotAmount = pots.reduce((sum, p) => sum + p.amount, 0);
      expect(totalPotAmount).toBe(200);
      // Only p2 should be eligible
      for (const pot of pots) {
        expect(pot.playerUuids).toContain('p2');
        expect(pot.playerUuids).not.toContain('p1');
        expect(pot.playerUuids).not.toContain('p3');
      }
    });

    it('should create single pot when all players bet equally with no all-in', () => {
      const players = [
        makePlayer({ uuid: 'p1', seatIndex: 0, currentBet: 200, chips: 800 }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 200, chips: 800 }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 200, chips: 800 }),
        makePlayer({ uuid: 'p4', seatIndex: 3, currentBet: 200, chips: 800 }),
      ];

      const pots = calculator.calculatePots(players);

      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(800);
      expect(pots[0].playerUuids).toHaveLength(4);
    });
  });

  describe('calculateTotalPot', () => {
    it('should return sum of all player bets', () => {
      const players = [
        makePlayer({ uuid: 'p1', seatIndex: 0, currentBet: 50 }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100 }),
        makePlayer({ uuid: 'p3', seatIndex: 2, currentBet: 100 }),
      ];

      const total = calculator.calculateTotalPot(players);

      expect(total).toBe(250);
    });

    it('should include folded player bets in total', () => {
      const players = [
        makePlayer({
          uuid: 'p1',
          seatIndex: 0,
          currentBet: 30,
          isFolded: true,
        }),
        makePlayer({ uuid: 'p2', seatIndex: 1, currentBet: 100 }),
      ];

      const total = calculator.calculateTotalPot(players);

      expect(total).toBe(130);
    });

    it('should return 0 when no players', () => {
      const total = calculator.calculateTotalPot([]);

      expect(total).toBe(0);
    });
  });
});
