import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { EvaluationAttempt } from './evaluation-attempt.entity';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  exerciseItems: EvaluationExerciseItem[];

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  theme: string;

  @Column({ type: 'simple-array', nullable: true })
  competencies: string[];

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  durationSeconds: number;

  @Column({ default: false })
  blockBackNavigation: boolean;

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

  @OneToMany(() => EvaluationAttempt, (attempt) => attempt.evaluation)
  attempts: EvaluationAttempt[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface EvaluationExerciseItem {
  exerciseId: string;
  titleOverride?: string;
  order: number;
}
