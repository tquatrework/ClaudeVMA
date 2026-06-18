import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ForumPublic } from '../../common/enums/forum-public.enum';
import { ForumComment } from './forum-comment.entity';
import { ForumExclusion } from './forum-exclusion.entity';

@Entity('forums')
export class Forum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  theme: string;

  @Column({ nullable: true })
  competences: string;

  @Column({ nullable: true })
  tags: string;

  @Column({
    type: 'varchar',
    default: ForumPublic.MIXTE,
  })
  public: ForumPublic;

  @Column()
  createdById: string;

  @Column()
  createdByRole: string;

  @Column({ default: false })
  isPublished: boolean;

  @OneToMany(() => ForumComment, (comment) => comment.forum, { cascade: true })
  comments: ForumComment[];

  @OneToMany(() => ForumExclusion, (exclusion) => exclusion.forum, { cascade: true })
  exclusions: ForumExclusion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
