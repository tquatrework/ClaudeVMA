import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FinancialProfileType {
  LIMITE = 'limite',
  MEMBRE = 'membre',
}

export enum PaymentMethod {
  CB = 'cb',
  VIREMENT = 'virement',
  PAYPAL = 'paypal',
}

/**
 * Financial profile for a funding owner (parent_financeur).
 * FIN-FB-001: type switches from "limite" to "membre" when inscription is paid and mandate signed.
 */
@Entity('financial_profiles')
export class FinancialProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** User ID of the funding owner (parent_financeur) */
  @Column({ name: 'owner_id', unique: true })
  ownerId: string;

  /** Account type: "limite" (not yet paid) or "membre" (inscription paid) */
  @Column({
    name: 'profile_type',
    type: 'varchar',
    default: FinancialProfileType.LIMITE,
  })
  profileType: FinancialProfileType;

  /** Current balance of financial points (deducted when teacher payments are validated) */
  @Column({ name: 'points_balance', type: 'integer', default: 0 })
  pointsBalance: number;

  /** Optional end date for funding period */
  @Column({ name: 'funding_end_date', nullable: true, type: 'varchar' })
  fundingEndDate: string | null;

  /** Preferred payment method */
  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: PaymentMethod | null;

  /** External payment reference (bank IBAN, PayPal email, etc.) — stored masked for security */
  @Column({ name: 'payment_reference', nullable: true, type: 'text' })
  paymentReference: string | null;

  /** Optional correlation id for inter-service tracing */
  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
