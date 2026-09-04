import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ForumTopic } from './forum-topic.entity';

/**
 * Un commentaire appartient désormais à un sujet (`ForumTopic`), qui
 * appartient lui-même à un forum — arbitrage du 2026-09-04 ("Structure en
 * sujets (topics) des Forums"). Il n'appartient plus directement à un forum
 * (`forumId` a été retiré ; le forum s'obtient via `topic.forumId`).
 */
@Entity('forum_comments')
export class ForumComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  topicId: string;

  @ManyToOne(() => ForumTopic, (topic) => topic.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topicId' })
  topic: ForumTopic;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
