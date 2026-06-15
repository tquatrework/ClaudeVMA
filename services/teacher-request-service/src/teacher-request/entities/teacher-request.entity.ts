import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';


export enum RequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  REDIRECTED = 'redirected',
  CANDIDATES_SELECTED = 'candidates_selected',
  CANDIDATE_CHOSEN = 'candidate_chosen',
  ASSIGNED = 'assigned',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

export enum RequestType {
  SPECIFIC = 'specific',
  PP_CHANGE = 'pp_change',
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

  @Column({ type: 'varchar', default: RequestType.SPECIFIC })
  type: RequestType;

  @Column({ name: 'current_pp_teacher_id', nullable: true })
  currentPpTeacherId: string;

  @Column({ name: 'chosen_teacher_id', nullable: true })
  chosenTeacherId: string;

  @Column({ type: 'varchar', default: RequestStatus.PENDING })
  status: RequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
