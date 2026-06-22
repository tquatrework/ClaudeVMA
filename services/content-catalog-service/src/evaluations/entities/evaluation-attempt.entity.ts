import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';

export enum AttemptStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Entity('evaluation_attempts')
export class EvaluationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  evaluationId: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: Evaluation;

  @Column()
  studentId: string;

  @Column({
    type: 'enum',
    enum: AttemptStatus,
    default: AttemptStatus.IN_PROGRESS,
  })
  status: AttemptStatus;

  @Column({ type: 'jsonb', nullable: true })
  answers: Record<string, string>;

  @Column({ nullable: true })
  score: number;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
