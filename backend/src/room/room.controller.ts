import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import * as express from 'express';
import { RoomService } from './room.service.js';
import { CreateRoomDto } from './create-room.dto.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  async getWaitingRooms() {
    return this.roomService.getWaitingRooms();
  }

  @Post()
  async createRoom(@Req() req: express.Request, @Body() dto: CreateRoomDto) {
    const uuid = (req as any).cookies?.player_uuid;
    if (!uuid) {
      return { success: false, error: '인증이 필요합니다.' };
    }
    const room = await this.roomService.createRoom(uuid, dto);
    return { success: true, roomId: room.id };
  }
}
