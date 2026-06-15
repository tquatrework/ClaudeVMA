import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum EventDirection {
  CONSUMED = 'consumed',
  PUBLISHED = 'published',
}

@Entity('integration_events')
export class IntegrationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  eventType: string;

  @Column({ length: 36 })
  correlationId: string;

  @Column({ type: 'enum', enum: EventDirection })
  direction: EventDirection;

  @Column({ length: 100, nullable: true })
  sourceService: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ default: false })
  processed: boolean;

  @CreateDateColumn()
  occurredAt: Date;
}
