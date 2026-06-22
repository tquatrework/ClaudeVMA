import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exercise_corrections')
export class ExerciseCorrection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  answerId: string;

  @Column()
  exerciseId: string;

  @Column()
  correctorId: string;

  @Column()
  correctorRole: string;

  @Column({ type: 'text', nullable: true })
  globalComment: string;

  @Column({ type: 'jsonb', nullable: true })
  partResults: Record<string, { isCorrect: boolean; comment: string }>;

  @Column({ nullable: true })
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
