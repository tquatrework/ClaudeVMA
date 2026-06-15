import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum CompensationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('compensation_actions')
@Index(['workflowInstanceId'])
export class CompensationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  workflowInstanceId: string;

  @Column({ length: 100 })
  stepName: string;

  @Column({ length: 100 })
  targetService: string;

  @Column({ length: 100 })
  compensationAction: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'enum', enum: CompensationStatus, default: CompensationStatus.PENDING })
  status: CompensationStatus;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @CreateDateColumn()
  registeredAt: Date;

  @Column({ nullable: true })
  executedAt: Date;
}
