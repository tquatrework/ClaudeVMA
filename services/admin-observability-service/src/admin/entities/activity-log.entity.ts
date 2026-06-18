import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  operatorId: string;

  @Column()
  operatorRole: string;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({ nullable: true })
  correlationId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  createdAt: Date;
}
