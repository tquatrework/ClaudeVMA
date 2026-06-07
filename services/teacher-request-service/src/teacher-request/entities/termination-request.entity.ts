import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TerminationStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
}

@Entity('termination_requests')
export class TerminationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id' })
  assignmentId: string;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ type: 'date', name: 'notice_date' })
  noticeDate: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', default: TerminationStatus.PENDING })
  status: TerminationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
