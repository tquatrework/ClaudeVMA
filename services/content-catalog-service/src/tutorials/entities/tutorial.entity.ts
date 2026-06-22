import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { TutorialType, TutorialFormat } from '../../common/enums/content-type.enum';

@Entity('tutorials')
export class Tutorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TutorialType,
  })
  tutorialType: TutorialType;

  @Column({
    type: 'enum',
    enum: TutorialFormat,
  })
  format: TutorialFormat;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  theme: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ type: 'text', nullable: true })
  textContent: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'simple-array', nullable: true })
  relatedResourceIds: string[];

  @Column({ nullable: true })
  relatedEvaluationId: string;

  @Column()
  authorId: string;

  @Column()
  authorRole: string;

  @Column({
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.DRAFT,
  })
  status: ContentStatus;

  @Column({ nullable: true })
  shareableLink: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
