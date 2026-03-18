import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Player } from '../player/player.entity.js';
import { RoomPlayer } from './room-player.entity.js';
import type {
  PokerVariant,
  GameMode,
  RoomStatus,
  RoomSettings,
} from '../common/types';

@Entity('room')
export class Room {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  variant: PokerVariant;

  @Column({ type: 'text' })
  mode: GameMode;

  @Column({ type: 'text', default: 'waiting' })
  status: RoomStatus;

  @Column({ type: 'text' })
  hostUuid: string;

  @Column({ type: 'integer', default: 6 })
  maxPlayers: number;

  @Column({ type: 'text' })
  settings: string; // JSON string of RoomSettings

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'hostUuid' })
  host: Player;

  @OneToMany(() => RoomPlayer, (rp) => rp.room)
  roomPlayers: RoomPlayer[];

  getSettings(): RoomSettings {
    return JSON.parse(this.settings) as RoomSettings;
  }

  setSettings(settings: RoomSettings): void {
    this.settings = JSON.stringify(settings);
  }
}
