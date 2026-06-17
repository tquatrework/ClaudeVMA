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
 * VideoRecording — declares that a recording is available for a given room.
 * VID-AC-001: recordings expire after 30 days (acceptance criterion).
 * VID-AC-001: parent_financeur has no access to recordings.
 */
@Entity('video_recordings')
export class VideoRecording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => VideoRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: VideoRoom;

  @Column({ name: 'declared_by' })
  declaredBy: string;

  @Column({ name: 'download_url', nullable: true, type: 'text' })
  downloadUrl: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
