import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ParentLinkRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Represents a request by a parent/financeur to be linked to a student.
 * The parent provides the studentId (communicated out-of-band).
 * The student, RP, or TI can approve or reject the request.
 */
@Entity('parent_link_requests')
export class ParentLinkRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID of the parent_financeur who submits the request */
  @Column('uuid', { name: 'parent_id' })
  parentId: string;

  /** UUID of the student (élève) targeted by the request */
  @Column('uuid', { name: 'student_id' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: ParentLinkRequestStatus,
    default: ParentLinkRequestStatus.PENDING,
  })
  status: ParentLinkRequestStatus;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  /** Set when the request is approved or rejected */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /** UUID of the actor who approved or rejected the request */
  @Column('uuid', { name: 'processed_by', nullable: true })
  processedBy: string | null;
}
