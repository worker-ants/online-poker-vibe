import type {
  PokerVariant,
  GameState,
  PlayerAction,
  PlayerSeat,
  HandResult,
  BettingAction,
} from '../../common/types/game.types.js';
import type { IGameMode } from './modes/game-mode.interface.js';

export interface IPokerEngine {
  readonly variant: PokerVariant;

  initialize(players: PlayerSeat[], mode: IGameMode): GameState;
  startHand(state: GameState): GameState;
  handleAction(
    state: GameState,
    playerUuid: string,
    action: PlayerAction,
  ): GameState;
  getValidActions(
    state: GameState,
    playerUuid: string,
  ): {
    actions: BettingAction[];
    callAmount: number;
    minRaise: number;
    maxRaise: number;
  };
  isHandComplete(state: GameState): boolean;
  resolveHand(state: GameState): HandResult;
}
