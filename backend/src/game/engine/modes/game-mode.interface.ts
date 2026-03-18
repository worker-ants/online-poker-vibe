export interface IGameMode {
  readonly mode: 'tournament' | 'cash';

  getSmallBlind(handNumber: number): number;
  getBigBlind(handNumber: number): number;
  getAnte(handNumber: number): number;
  getStartingChips(): number;

  canPlayerLeave(): boolean;
  canPlayerJoinMidGame(): boolean;
  isPlayerEliminated(chips: number): boolean;
  isGameOver(activePlayers: number): boolean;
}
