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
 * CourseSummary — pedagogical summary of a completed video session.
 * VID-AC-002: the summary is permanent (isPermanent: true) and survives
 * video recording expiry. It feeds the pedagogical archives.
 */
@Entity('course_summaries')
export class CourseSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => VideoRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: VideoRoom;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  /**
   * Always true: course summaries survive video expiry and belong to pedagogical archives.
   * VID-AC-002.
   */
  @Column({ name: 'is_permanent', default: true })
  isPermanent: boolean;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
