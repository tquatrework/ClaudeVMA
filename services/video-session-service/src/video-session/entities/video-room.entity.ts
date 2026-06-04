import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RoomStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  ENDED = 'ended',
}

@Entity('video_rooms')
export class VideoRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'calendar_session_id' })
  calendarSessionId: string;

  @Column({ name: 'room_token', unique: true })
  roomToken: string;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.WAITING })
  status: RoomStatus;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
