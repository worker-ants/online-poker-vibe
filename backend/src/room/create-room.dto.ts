import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import type {
  PokerVariant,
  GameMode,
  RoomSettings,
} from '../common/types/index.js';

export class CreateRoomDto {
  @IsString()
  name: string;

  @IsIn(['texas-holdem', 'five-card-draw', 'seven-card-stud'])
  variant: PokerVariant;

  @IsIn(['tournament', 'cash'])
  mode: GameMode;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  maxPlayers?: number;

  @IsOptional()
  @IsObject()
  settings?: Partial<RoomSettings>;
}
