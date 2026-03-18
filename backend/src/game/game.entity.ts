import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Room } from '../room/room.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import type { PokerVariant, GameMode, GameStatus } from '../common/types';

@Entity('game')
export class Game {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Index()
  @Column({ type: 'text', nullable: true })
  roomId: string | null;

  @Column({ type: 'text' })
  variant: PokerVariant;

  @Column({ type: 'text' })
  mode: GameMode;

  @Index()
  @Column({ type: 'text', default: 'in-progress' })
  status: GameStatus;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roomId' })
  room: Room | null;

  @OneToMany(() => GameParticipant, (gp) => gp.game)
  participants: GameParticipant[];
}
