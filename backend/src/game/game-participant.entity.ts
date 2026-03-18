import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.entity.js';
import { Player } from '../player/player.entity.js';
import type { GameResult } from '../common/types';

@Entity('game_participant')
@Unique(['gameId', 'playerUuid'])
export class GameParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  gameId: string;

  @Column({ type: 'text' })
  playerUuid: string;

  @Column({ type: 'text' })
  result: GameResult;

  @Column({ type: 'integer', default: 0 })
  chipsDelta: number;

  @Column({ type: 'integer', default: 0 })
  finalChips: number;

  @Column({ type: 'integer', nullable: true })
  placement: number | null;

  @ManyToOne(() => Game, (game) => game.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @ManyToOne(() => Player, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'playerUuid' })
  player: Player;
}
