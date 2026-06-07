import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ActivityType {
  COURS = 'cours',
  REUNION_PEDAGOGIQUE = 'reunion_pedagogique',
  ENTRETIEN_RP = 'entretien_rp',
  RAPPEL = 'rappel',
  AUTRE = 'autre',
}

export enum ActivityStatus {
  PROPOSED = 'proposed',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/**
 * A planned activity involving one or more participants (CAL-BR-007, CAL-BR-008, CAL-BR-009).
 * Stores participants, creator, type, schedule, and status to satisfy CAL-FB-002.
 */
@Entity('scheduled_activities')
export class ScheduledActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'varchar' })
  type: ActivityType;

  /** User ID of the activity creator */
  @Column({ name: 'creator_id' })
  creatorId: string;

  /** Role of the creator */
  @Column({ name: 'creator_role' })
  creatorRole: string;

  /**
   * Array of participant user IDs stored as JSON.
   * CAL-FB-002: must contain at least one participant.
   */
  @Column({ type: 'simple-json', name: 'participant_ids' })
  participantIds: string[];

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'varchar', default: ActivityStatus.PROPOSED })
  status: ActivityStatus;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  /** Optional correlation id for inter-service tracing */
  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
