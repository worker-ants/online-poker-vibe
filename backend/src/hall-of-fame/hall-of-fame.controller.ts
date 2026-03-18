import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { HallOfFameService } from './hall-of-fame.service.js';

@Controller('hall-of-fame')
export class HallOfFameController {
  constructor(private readonly hallOfFameService: HallOfFameService) {}

  @Get()
  async getRankings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit ?? '20', 10) || 20),
    );
    return this.hallOfFameService.getRankings(pageNum, limitNum);
  }

  @Get(':playerUuid/history')
  async getPlayerHistory(
    @Param('playerUuid', ParseUUIDPipe) playerUuid: string,
  ) {
    return this.hallOfFameService.getPlayerHistory(playerUuid);
  }
}
