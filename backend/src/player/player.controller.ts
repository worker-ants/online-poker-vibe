import { Controller, Get, Post, Body, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PlayerService } from './player.service.js';

const COOKIE_NAME = 'player_uuid';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  private getOrCreateUuid(req: Request, res: Response): string {
    let uuid = req.cookies?.[COOKIE_NAME];
    if (!uuid) {
      uuid = uuidv4();
      res.cookie(COOKIE_NAME, uuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }
    return uuid;
  }

  @Get('me')
  async getMe(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const uuid = this.getOrCreateUuid(req, res);
    const player = await this.playerService.findOrCreate(uuid);
    return { uuid: player.uuid, nickname: player.nickname };
  }

  @Post('nickname')
  async setNickname(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('nickname') nickname: string,
  ) {
    const uuid = this.getOrCreateUuid(req, res);
    const player = await this.playerService.setNickname(uuid, nickname);
    return { uuid: player.uuid, nickname: player.nickname };
  }
}
