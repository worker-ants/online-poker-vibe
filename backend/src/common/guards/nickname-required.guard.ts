import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PlayerService } from '../../player/player.service.js';

@Injectable()
export class NicknameRequiredGuard implements CanActivate {
  constructor(private readonly playerService: PlayerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const uuid = (request.cookies as Record<string, string> | undefined)
      ?.player_uuid;

    if (!uuid) {
      throw new ForbiddenException('플레이어 식별 쿠키가 없습니다.');
    }

    const hasNickname = await this.playerService.isNicknameSet(uuid);
    if (!hasNickname) {
      throw new ForbiddenException('닉네임을 먼저 설정해주세요.');
    }

    return true;
  }
}
