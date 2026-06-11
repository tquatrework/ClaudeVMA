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
 * VideoAccessToken — short-lived token granting a specific user access to a room.
 * VID-BR-005: tokens are generated only for authorised participants.
 * VID-FB-002: a non-participant must not obtain an access token.
 */
@Entity('video_access_tokens')
export class VideoAccessToken {
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

  /** Opaque token value (UUID v4) passed to the video provider. */
  @Column({ name: 'token', unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used', default: false })
  used: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
