import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('integration_commands')
export class IntegrationCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  idempotencyKey: string;

  @Column({ length: 100 })
  targetService: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 36 })
  correlationId: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>;

  @Column({ default: false })
  dispatched: boolean;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  dispatchedAt: Date;
}
