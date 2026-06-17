import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Exercise } from './exercise.entity';

@Entity('exercise_parts')
export class ExercisePart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  exerciseId: string;

  @ManyToOne(() => Exercise, (exercise) => exercise.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise: Exercise;

  @Column()
  partNumber: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  expectedAnswer: string;

  @CreateDateColumn()
  createdAt: Date;
}
