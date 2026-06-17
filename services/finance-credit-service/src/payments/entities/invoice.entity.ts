import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum InvoiceStatus {
  ISSUED = 'issued',
  CANCELLED = 'cancelled',
}

/**
 * Invoice generated automatically upon payment confirmation.
 * FIN-AC-001: every confirmed payment triggers an InvoiceIssued event.
 */
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Reference to the payment that triggered this invoice */
  @Column({ name: 'payment_id' })
  paymentId: string;

  /** Invoice number for display and accounting purposes */
  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ name: 'invoice_status', type: 'varchar', default: InvoiceStatus.ISSUED })
  invoiceStatus: InvoiceStatus;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt: Date;
}
