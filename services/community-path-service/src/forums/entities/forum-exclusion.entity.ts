import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Forum } from './forum.entity';

@Entity('forum_exclusions')
export class ForumExclusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  forumId: string;

  @ManyToOne(() => Forum, (forum) => forum.exclusions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'forumId' })
  forum: Forum;

  @Column()
  excludedUserId: string;

  @Column()
  excludedByUserId: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
