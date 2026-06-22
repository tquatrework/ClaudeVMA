import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';
import { LearningPath } from './learning-path.entity';
import { PathProgress } from './path-progress.entity';

@Entity('path_enrollments')
export class PathEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  learningPathId: string;

  @ManyToOne(() => LearningPath, (path) => path.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'learningPathId' })
  learningPath: LearningPath;

  @Column()
  studentId: string;

  @Column({
    type: 'varchar',
    default: EnrollmentStatus.IN_PROGRESS,
  })
  status: EnrollmentStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progressPercent: number;

  @OneToMany(() => PathProgress, (progress) => progress.enrollment, { cascade: true })
  progressEntries: PathProgress[];

  @CreateDateColumn()
  enrolledAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
