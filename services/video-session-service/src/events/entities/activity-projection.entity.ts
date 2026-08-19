import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * ActivityProjection — local read-model of a `ScheduledActivity` fed by
 * calendar-service's `ActivityScheduled` domain event.
 *
 * Why this exists: `ActivityConfirmed` (the event that must trigger automatic
 * room creation) carries only `{activityId, confirmedBy}` — verified against the
 * real Redis stream on 2026-08-19, not assumed from documentation. It does not
 * carry `type` nor `participantIds`, both required to decide whether to create a
 * room and who may join it. `ActivityScheduled`, published earlier in the same
 * activity's lifecycle, carries `{type, creatorId, startTime, activityId,
 * recipientId, participantIds}`. This table stores that projection so the
 * consumer can look it up when the matching `ActivityConfirmed` arrives later,
 * without calling back into calendar-service (which has no internal route for
 * this today — see docs/routes.md, video-session-service section).
 */
@Entity('activity_projections')
export class ActivityProjection {
  @PrimaryColumn({ name: 'activity_id' })
  activityId: string;

  @Column({ name: 'type' })
  type: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ name: 'participant_ids', type: 'jsonb' })
  participantIds: string[];

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
