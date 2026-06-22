import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LearningPath } from './learning-path.entity';

@Entity('path_steps')
export class PathStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  learningPathId: string;

  @ManyToOne(() => LearningPath, (path) => path.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath: LearningPath;

  @Column({ type: 'int' })
  order: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  contentReferenceId: string;

  @Column({ nullable: true })
  contentType: string;

  @CreateDateColumn()
  createdAt: Date;
}
