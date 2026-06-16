import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ArchiveItemType {
  PAYMENT = 'payment',
  INVOICE = 'invoice',
  LEDGER_ENTRY = 'ledger_entry',
}

/**
 * Archive entry linking financial events to a funding owner's history.
 * FIN-AC-001: each confirmed payment generates an archive item visible to the owner.
 */
@Entity('financial_archive_items')
export class FinancialArchiveItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'item_type', type: 'varchar' })
  itemType: ArchiveItemType;

  /** ID of the referenced entity (payment, invoice, or ledger entry) */
  @Column({ name: 'reference_id' })
  referenceId: string;

  /** Human-readable label for display in the financial archive list */
  @Column({ name: 'label', type: 'text' })
  label: string;

  /** Amount in cents (positive = received, negative = deducted) */
  @Column({ name: 'amount_cents', type: 'integer', nullable: true })
  amountCents: number | null;

  /** Running balance snapshot at time of this event */
  @Column({ name: 'balance_snapshot', type: 'integer', nullable: true })
  balanceSnapshot: number | null;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
