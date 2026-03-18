import { Module } from '@nestjs/common';
import { AiPlayerService } from './ai-player.service.js';

@Module({
  providers: [AiPlayerService],
  exports: [AiPlayerService],
})
export class AiPlayerModule {}
