import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../game/game.entity.js';
import { GameParticipant } from '../game/game-participant.entity.js';
import { Player } from '../player/player.entity.js';
import { HallOfFameService } from './hall-of-fame.service.js';
import { HallOfFameController } from './hall-of-fame.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameParticipant, Player])],
  controllers: [HallOfFameController],
  providers: [HallOfFameService],
})
export class HallOfFameModule {}
