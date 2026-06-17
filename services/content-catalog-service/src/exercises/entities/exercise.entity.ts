import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContentStatus } from '../../common/enums/content-status.enum';
import { ExercisePart } from './exercise-part.entity';
import { ExerciseAnswer } from './exercise-answer.entity';
import { ExerciseSolution } from './exercise-solution.entity';

@Entity('exercises')
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'text' })
  statement: string;

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

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  correctionCost: number;

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

  @OneToMany(() => ExercisePart, (part) => part.exercise, { cascade: true })
  parts: ExercisePart[];

  @OneToMany(() => ExerciseAnswer, (answer) => answer.exercise)
  answers: ExerciseAnswer[];

  @OneToMany(() => ExerciseSolution, (solution) => solution.exercise)
  solutions: ExerciseSolution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
