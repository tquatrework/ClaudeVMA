import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Forum } from './forum.entity';

@Entity('forum_comments')
export class ForumComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  forumId: string;

  @ManyToOne(() => Forum, (forum) => forum.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'forumId' })
  forum: Forum;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
