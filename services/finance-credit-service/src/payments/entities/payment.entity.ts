import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentType {
  INSCRIPTION = 'inscription',
  ABONNEMENT = 'abonnement',
  VERSEMENT_PONCTUEL = 'versement_ponctuel',
}

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/**
 * Records a payment initiated by a funding owner.
 * FIN-AC-001: a confirmed payment creates an Invoice and a FinancialArchiveItem.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Funding owner who initiated the payment */
  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'payment_type', type: 'varchar' })
  paymentType: PaymentType;

  /** Amount in euros (integer cents to avoid floating-point issues) */
  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ name: 'payment_status', type: 'varchar', default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  /** External transaction reference from payment provider */
  @Column({ name: 'external_reference', nullable: true, type: 'varchar' })
  externalReference: string | null;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
