import type { PlayerState, SidePot } from '../../common/types/game.types.js';

export class PotCalculator {
  /**
   * Calculate main pot and side pots based on player bets.
   * Called at the end of a hand to determine how to distribute winnings.
   */
  calculatePots(players: PlayerState[]): SidePot[] {
    // Get active players (not folded) sorted by their total bet
    const activePlayers = players
      .filter((p) => !p.isFolded)
      .sort((a, b) => a.currentBet - b.currentBet);

    const allPlayers = [...players].sort((a, b) => a.currentBet - b.currentBet);

    if (activePlayers.length === 0) return [];

    const pots: SidePot[] = [];
    let processedBet = 0;

    // Find unique bet levels from all-in players
    const betLevels = [
      ...new Set(
        allPlayers
          .filter((p) => p.isAllIn && !p.isFolded)
          .map((p) => p.currentBet),
      ),
    ].sort((a, b) => a - b);

    // Add the max bet as the final level
    const maxBet = Math.max(...allPlayers.map((p) => p.currentBet));
    if (!betLevels.includes(maxBet)) {
      betLevels.push(maxBet);
    }

    if (betLevels.length === 0) {
      // No all-ins, single pot
      const amount = allPlayers.reduce((sum, p) => sum + p.currentBet, 0);
      const eligible = activePlayers.map((p) => p.uuid);
      if (amount > 0) {
        pots.push({ amount, playerUuids: eligible });
      }
      return pots;
    }

    for (const level of betLevels) {
      const contribution = level - processedBet;
      if (contribution <= 0) continue;

      // All players who bet at least this much contribute
      const contributors = allPlayers.filter((p) => p.currentBet >= level);
      // But also players who bet between processedBet and level
      const partialContributors = allPlayers.filter(
        (p) => p.currentBet > processedBet && p.currentBet < level,
      );

      let potAmount = 0;

      for (const p of allPlayers) {
        const playerContribution = Math.min(
          Math.max(p.currentBet - processedBet, 0),
          contribution,
        );
        potAmount += playerContribution;
      }

      // Eligible players: active (not folded) players who contributed at least this level
      const eligible = activePlayers
        .filter((p) => p.currentBet >= level)
        .map((p) => p.uuid);

      if (potAmount > 0 && eligible.length > 0) {
        pots.push({ amount: potAmount, playerUuids: eligible });
      }

      processedBet = level;
    }

    return pots;
  }

  /**
   * Simple pot calculation: total of all bets.
   */
  calculateTotalPot(players: PlayerState[]): number {
    return players.reduce((sum, p) => sum + p.currentBet, 0);
  }
}
