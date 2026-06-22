import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TeacherPaymentRequestStatus {
  PENDING = 'pending',
  VALIDATED = 'validated',
  REJECTED = 'rejected',
}

/**
 * Payment request submitted by a teacher (formateur) with attached invoice.
 * FIN-AC-003: validated by AF, consumes financial points from the linked financeur.
 */
@Entity('teacher_payment_requests')
export class TeacherPaymentRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Teacher (formateur) who submitted this payment request */
  @Column({ name: 'teacher_id' })
  teacherId: string;

  /** Funding owner (parent_financeur) whose points will be debited */
  @Column({ name: 'funding_owner_id' })
  fundingOwnerId: string;

  /** Student linked to this payment session */
  @Column({ name: 'student_id', nullable: true, type: 'varchar' })
  studentId: string | null;

  /** Amount in euro cents to pay to the teacher */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  /** Description of the service rendered (e.g., "Cours maths — 2h — 15 juin 2026") */
  @Column({ name: 'description', type: 'text' })
  description: string;

  /** Invoice reference submitted by the teacher */
  @Column({ name: 'invoice_reference', nullable: true, type: 'varchar' })
  invoiceReference: string | null;

  @Column({
    name: 'request_status',
    type: 'varchar',
    default: TeacherPaymentRequestStatus.PENDING,
  })
  requestStatus: TeacherPaymentRequestStatus;

  /** Rejection reason set by AF when rejecting */
  @Column({ name: 'rejection_reason', nullable: true, type: 'text' })
  rejectionReason: string | null;

  /** ID of the AF user who validated or rejected this request */
  @Column({ name: 'reviewed_by', nullable: true, type: 'varchar' })
  reviewedBy: string | null;

  /** Idempotency key for orchestration-service */
  @Column({ name: 'idempotency_key', nullable: true, unique: true, type: 'varchar' })
  idempotencyKey: string | null;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
