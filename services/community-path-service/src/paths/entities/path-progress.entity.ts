import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PathEnrollment } from './path-enrollment.entity';

@Entity('path_progress')
export class PathProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  enrollmentId: string;

  @ManyToOne(() => PathEnrollment, (enrollment) => enrollment.progressEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollmentId' })
  enrollment: PathEnrollment;

  @Column()
  stepId: string;

  @Column({ default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  updatedAt: Date;
}
