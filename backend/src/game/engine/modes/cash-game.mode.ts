import type { IGameMode } from './game-mode.interface.js';

export class CashGameMode implements IGameMode {
  readonly mode = 'cash' as const;

  private startingChips: number;
  private smallBlind: number;
  private bigBlind: number;

  constructor(startingChips: number, smallBlind: number, bigBlind: number) {
    this.startingChips = startingChips;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getSmallBlind(_handNumber: number): number {
    return this.smallBlind;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBigBlind(_handNumber: number): number {
    return this.bigBlind;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAnte(_handNumber: number): number {
    return 0;
  }

  getStartingChips(): number {
    return this.startingChips;
  }

  canPlayerLeave(): boolean {
    return true;
  }

  canPlayerJoinMidGame(): boolean {
    return true;
  }

  isPlayerEliminated(chips: number): boolean {
    return chips <= 0;
  }

  isGameOver(activePlayers: number): boolean {
    return activePlayers < 2;
  }
}
