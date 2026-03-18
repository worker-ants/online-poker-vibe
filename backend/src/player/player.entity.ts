import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('player')
export class Player {
  @PrimaryColumn({ type: 'text' })
  @Index()
  uuid: string;

  @Column({ type: 'text', nullable: true, unique: true })
  nickname: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
