import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './room.entity.js';
import { RoomPlayer } from './room-player.entity.js';
import { RoomService } from './room.service.js';
import { RoomController } from './room.controller.js';
import { RoomGateway } from './room.gateway.js';
import { PlayerModule } from '../player/player.module.js';
import { GameModule } from '../game/game.module.js';
import { AiPlayerModule } from '../ai/ai-player.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomPlayer]),
    PlayerModule,
    forwardRef(() => GameModule),
    AiPlayerModule,
  ],
  controllers: [RoomController],
  providers: [RoomService, RoomGateway],
  exports: [RoomService],
})
export class RoomModule {}
