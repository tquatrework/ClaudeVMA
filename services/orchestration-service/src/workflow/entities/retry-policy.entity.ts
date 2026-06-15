import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('retry_policies')
@Index(['workflowStepId'])
export class RetryPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  workflowStepId: string;

  @Column({ length: 36 })
  workflowInstanceId: string;

  @Column()
  attemptNumber: number;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @Column({ default: false })
  retriedAfterThis: boolean;

  @CreateDateColumn()
  attemptedAt: Date;
}
