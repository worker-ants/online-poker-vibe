import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { RoomService } from './room.service.js';
import { CreateRoomDto } from './create-room.dto.js';
import { PlayerUuid } from '../common/decorators/player-uuid.decorator.js';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  async getWaitingRooms() {
    return this.roomService.getWaitingRooms();
  }

  @Post()
  async createRoom(
    @PlayerUuid() uuid: string | undefined,
    @Body() dto: CreateRoomDto,
  ) {
    if (!uuid) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }
    const room = await this.roomService.createRoom(uuid, dto);
    return { success: true, roomId: room.id };
  }
}
