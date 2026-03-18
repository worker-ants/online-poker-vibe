import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const PlayerUuid = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request.cookies as Record<string, string> | undefined)?.player_uuid;
  },
);
