import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Room } from '../room/room.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import type {
  PokerVariant,
  GameMode,
  GameStatus,
} from '../common/types/index.js';

@Entity('game')
export class Game {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  roomId: string;

  @Column({ type: 'text' })
  variant: PokerVariant;

  @Column({ type: 'text' })
  mode: GameMode;

  @Column({ type: 'text', default: 'in-progress' })
  status: GameStatus;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @OneToMany(() => GameParticipant, (gp) => gp.game)
  participants: GameParticipant[];
}
