import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PokerVariant, GameMode, RoomSettings } from '../common/types';

export class RoomSettingsDto implements Partial<RoomSettings> {
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'startingChips must be greater than 0' })
  startingChips?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'smallBlind must be greater than 0' })
  smallBlind?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'bigBlind must be greater than 0' })
  bigBlind?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'ante must be >= 0' })
  ante?: number;
}

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
  @Max(10)
  maxPlayers?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RoomSettingsDto)
  settings?: RoomSettingsDto;
}
