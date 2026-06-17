import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VideoRecording } from './video-recording.entity';

/**
 * RecordingComment — timestamped annotation on a video recording.
 * VID-AC-001: parent_financeur cannot add comments (forbidden from all recording access).
 */
@Entity('recording_comments')
export class RecordingComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recording_id' })
  recordingId: string;

  @ManyToOne(() => VideoRecording, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recording_id' })
  recording: VideoRecording;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'timestamp_seconds', type: 'integer' })
  timestampSeconds: number;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
