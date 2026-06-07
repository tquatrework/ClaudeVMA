import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RequestStatus {
  PENDING = 'pending',
  REDIRECTED = 'redirected',
  ASSIGNED = 'assigned',
  CANCELLED = 'cancelled',
}

@Entity('teacher_requests')
export class TeacherRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ name: 'requester_role' })
  requesterRole: string;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column()
  subject: string;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  sector: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'varchar', default: RequestStatus.PENDING })
  status: RequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
