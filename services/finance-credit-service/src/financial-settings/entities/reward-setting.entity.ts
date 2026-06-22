import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configurable reward settings managed by AF.
 * FIN-FB-003: AF can adjust prices (in euro cents) and point rewards.
 * Each record represents a named parameter with its current value.
 */
@Entity('reward_settings')
export class RewardSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique key for this setting (e.g., "inscription_price_cents", "points_per_euro") */
  @Column({ name: 'setting_key', type: 'varchar', unique: true })
  settingKey: string;

  /** Human-readable label for display in the AF interface */
  @Column({ name: 'label', type: 'varchar' })
  label: string;

  /** Numeric value (interpretation depends on setting_key) */
  @Column({ name: 'value', type: 'integer' })
  value: number;

  /** Optional description explaining the purpose and unit of this setting */
  @Column({ name: 'description', nullable: true, type: 'text' })
  description: string | null;

  /** ID of the last AF user who modified this setting */
  @Column({ name: 'updated_by', nullable: true, type: 'varchar' })
  updatedBy: string | null;

  @Column({ name: 'correlation_id', nullable: true, type: 'varchar' })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
