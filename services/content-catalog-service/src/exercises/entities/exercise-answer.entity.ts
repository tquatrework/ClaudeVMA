import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('exercise_answers')
export class ExerciseAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exerciseId: string;

  @ManyToOne(() => Exercise, (exercise) => exercise.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @Column()
  studentId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  partId: string;

  @Column({ default: false })
  correctionRequested: boolean;

  @Column({ nullable: true })
  correctionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
