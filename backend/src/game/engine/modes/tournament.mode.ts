import type { IGameMode } from './game-mode.interface.js';
import type { BlindLevel } from '../../../common/types/game.types.js';

export class TournamentMode implements IGameMode {
  readonly mode = 'tournament' as const;

  private startingChips: number;
  private blindSchedule: BlindLevel[];

  constructor(startingChips: number, blindSchedule: BlindLevel[]) {
    this.startingChips = startingChips;
    this.blindSchedule = blindSchedule;
  }

  getSmallBlind(handNumber: number): number {
    const level = this.getCurrentLevel(handNumber);
    return level.smallBlind;
  }

  getBigBlind(handNumber: number): number {
    const level = this.getCurrentLevel(handNumber);
    return level.bigBlind;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAnte(_handNumber: number): number {
    return 0;
  }

  getStartingChips(): number {
    return this.startingChips;
  }

  canPlayerLeave(): boolean {
    return false;
  }

  canPlayerJoinMidGame(): boolean {
    return false;
  }

  isPlayerEliminated(chips: number): boolean {
    return chips <= 0;
  }

  isGameOver(activePlayers: number): boolean {
    return activePlayers <= 1;
  }

  private getCurrentLevel(handNumber: number): BlindLevel {
    let handsPlayed = handNumber;
    for (const level of this.blindSchedule) {
      if (handsPlayed <= level.handsPerLevel) {
        return level;
      }
      handsPlayed -= level.handsPerLevel;
    }
    // Return last level if we've exceeded the schedule
    return this.blindSchedule[this.blindSchedule.length - 1];
  }
}
