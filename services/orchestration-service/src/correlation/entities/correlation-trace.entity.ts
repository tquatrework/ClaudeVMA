import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('correlation_traces')
@Index(['correlationId'])
export class CorrelationTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  correlationId: string;

  @Column({ length: 60 })
  entityType: string;

  @Column({ length: 36, nullable: true })
  entityId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true, length: 255 })
  actor: string;

  @Column({ default: false })
  isTiOverride: boolean;

  @CreateDateColumn()
  occurredAt: Date;
}
