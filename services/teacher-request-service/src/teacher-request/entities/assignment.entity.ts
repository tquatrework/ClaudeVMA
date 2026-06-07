import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AssignmentStatus {
  ACTIVE = 'active',
  TERMINATION_REQUESTED = 'termination_requested',
  TERMINATED = 'terminated',
}

@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ name: 'proposal_id' })
  proposalId: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @Column({ name: 'is_main_teacher', default: false })
  isMainTeacher: boolean;

  @Column({ type: 'varchar', default: AssignmentStatus.ACTIVE })
  status: AssignmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
