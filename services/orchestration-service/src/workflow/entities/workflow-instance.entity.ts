import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { WorkflowStatus } from '../../common/enums/workflow-status.enum';
import { WorkflowStep } from './workflow-step.entity';

@Entity('workflow_instances')
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  workflowType: string;

  @Column({ unique: true, length: 36 })
  correlationId: string;

  @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.PENDING })
  status: WorkflowStatus;

  @Column({ default: 0 })
  currentStepIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @Column({ nullable: true, length: 255 })
  initiatedBy: string;

  @OneToMany(() => WorkflowStep, (step) => step.workflowInstance, { cascade: true, eager: false })
  steps: WorkflowStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
