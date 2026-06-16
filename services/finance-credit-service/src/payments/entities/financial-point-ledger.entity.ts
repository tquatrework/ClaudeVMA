import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum LedgerEntryType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

/**
 * Immutable ledger of financial point movements for a funding owner.
 * FIN-AC-003: a validated teacher payment debits points from the financeur.
 */
@Entity('financial_point_ledger')
export class FinancialPointLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'entry_type', type: 'varchar' })
  entryType: LedgerEntryType;

  /** Number of points affected (always positive; direction determined by entryType) */
  @Column({ name: 'points_amount', type: 'integer' })
  pointsAmount: number;

  /** Balance after this entry */
  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter: number;

  /** Description of the operation for audit trail */
  @Column({ name: 'description', type: 'text' })
  description: string;

  /** Reference to the triggering entity (payment id, teacher payment request id, etc.) */
  @Column({ name: 'reference_id', nullable: true, type: 'varchar' })
  referenceId: string | null;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
