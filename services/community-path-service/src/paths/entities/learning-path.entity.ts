import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PathStatus } from '../../common/enums/path-status.enum';
import { PathStep } from './path-step.entity';
import { PathEnrollment } from './path-enrollment.entity';

@Entity('learning_paths')
export class LearningPath {
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

  @Column({ nullable: true })
  imageUrl: string;

  @Column({
    type: 'varchar',
    default: PathStatus.DRAFT,
  })
  status: PathStatus;

  @Column()
  createdById: string;

  @Column()
  createdByRole: string;

  @OneToMany(() => PathStep, (step) => step.learningPath, { cascade: true })
  steps: PathStep[];

  @OneToMany(() => PathEnrollment, (enrollment) => enrollment.learningPath, { cascade: true })
  enrollments: PathEnrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
