import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Room } from './room.entity.js';
import { Player } from '../player/player.entity.js';

@Entity('room_player')
@Unique(['roomId', 'playerUuid'])
@Unique(['roomId', 'seatIndex'])
export class RoomPlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  roomId: string;

  @Column({ type: 'text' })
  playerUuid: string;

  @Column({ type: 'integer' })
  seatIndex: number;

  @Column({ type: 'boolean', default: false })
  isReady: boolean;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => Room, (room) => room.roomPlayers)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'playerUuid' })
  player: Player;
}
