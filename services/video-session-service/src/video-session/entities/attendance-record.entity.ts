import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VideoRoom } from './video-room.entity';

/**
 * AttendanceRecord — traces who joined a room and when they left.
 * VID-BR-006: presence data is used to reconstruct session duration for
 * pedagogical-log-service and finance-credit-service.
 */
@Entity('attendance_records')
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => VideoRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: VideoRoom;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'user_role' })
  userRole: string;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
