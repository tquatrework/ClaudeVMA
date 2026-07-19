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

export enum ParentLinkRequestDirection {
  PARENT_INITIATED = 'parent_initiated',
  STUDENT_INITIATED = 'student_initiated',
}

/**
 * Represents a request to link a parent_financeur to a student (élève).
 *
 * Two directions are supported:
 * - parent_initiated: the parent submits a request; the student (or RP/TI) approves.
 * - student_initiated: the student invites their parent; the parent (or RP/TI) approves.
 */
@Entity('parent_link_requests')
export class ParentLinkRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID of the parent_financeur involved in this request */
  @Column('uuid', { name: 'parent_id' })
  parentId: string;

  /** UUID of the student (élève) involved in this request */
  @Column('uuid', { name: 'student_id' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: ParentLinkRequestStatus,
    default: ParentLinkRequestStatus.PENDING,
  })
  status: ParentLinkRequestStatus;

  /**
   * Indicates who initiated the request.
   * parent_initiated: parent sent the request, student must approve.
   * student_initiated: student sent the request, parent must approve.
   */
  @Column({
    type: 'enum',
    enum: ParentLinkRequestDirection,
    name: 'direction',
    default: ParentLinkRequestDirection.PARENT_INITIATED,
  })
  direction: ParentLinkRequestDirection;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  /** Set when the request is approved or rejected */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /** UUID of the actor who approved or rejected the request */
  @Column('uuid', { name: 'processed_by', nullable: true })
  processedBy: string | null;
}
