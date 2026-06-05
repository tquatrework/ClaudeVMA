import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { StepStatus } from '../../common/enums/step-status.enum';
import { WorkflowInstance } from './workflow-instance.entity';

@Entity('workflow_steps')
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workflowInstanceId: string;

  @ManyToOne(() => WorkflowInstance, (wf) => wf.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflowInstanceId' })
  workflowInstance: WorkflowInstance;

  @Column()
  stepOrder: number;

  @Column({ length: 100 })
  stepName: string;

  @Column({ length: 100 })
  targetService: string;

  @Column({ length: 100 })
  action: string;

  @Column({ type: 'enum', enum: StepStatus, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @Column({ nullable: true, length: 255 })
  idempotencyKey: string;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
