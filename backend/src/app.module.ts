import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { PlayerModule } from './player/player.module.js';
import { RoomModule } from './room/room.module.js';
import { GameModule } from './game/game.module.js';
import { HallOfFameModule } from './hall-of-fame/hall-of-fame.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PlayerModule,
    RoomModule,
    GameModule,
    HallOfFameModule,
  ],
})
export class AppModule {}
