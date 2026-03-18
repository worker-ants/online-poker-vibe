import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './game.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import { GameService } from './game.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameParticipant])],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
