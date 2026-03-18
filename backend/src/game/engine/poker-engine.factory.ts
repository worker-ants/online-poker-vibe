import type {
  PokerVariant,
  RoomSettings,
} from '../../common/types/game.types.js';
import type { IPokerEngine } from './poker-engine.interface.js';
import type { IGameMode } from './modes/game-mode.interface.js';
import { TexasHoldemEngine } from './variants/texas-holdem.engine.js';
import { FiveCardDrawEngine } from './variants/five-card-draw.engine.js';
import { SevenCardStudEngine } from './variants/seven-card-stud.engine.js';
import { TournamentMode } from './modes/tournament.mode.js';
import { CashGameMode } from './modes/cash-game.mode.js';

export class PokerEngineFactory {
  static createEngine(variant: PokerVariant): IPokerEngine {
    switch (variant) {
      case 'texas-holdem':
        return new TexasHoldemEngine();
      case 'five-card-draw':
        return new FiveCardDrawEngine();
      case 'seven-card-stud':
        return new SevenCardStudEngine();
      default:
        throw new Error(`지원하지 않는 포커 변형입니다: ${variant as string}`);
    }
  }

  static createMode(
    mode: 'tournament' | 'cash',
    settings: RoomSettings,
  ): IGameMode {
    switch (mode) {
      case 'tournament':
        return new TournamentMode(
          settings.startingChips,
          settings.blindSchedule ?? [
            { level: 1, smallBlind: 10, bigBlind: 20, handsPerLevel: 10 },
            { level: 2, smallBlind: 20, bigBlind: 40, handsPerLevel: 10 },
            { level: 3, smallBlind: 50, bigBlind: 100, handsPerLevel: 10 },
            { level: 4, smallBlind: 100, bigBlind: 200, handsPerLevel: 10 },
            { level: 5, smallBlind: 200, bigBlind: 400, handsPerLevel: 10 },
          ],
        );
      case 'cash':
        return new CashGameMode(
          settings.startingChips,
          settings.smallBlind,
          settings.bigBlind,
        );
      default:
        throw new Error(`지원하지 않는 게임 모드입니다: ${mode as string}`);
    }
  }
}
