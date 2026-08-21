import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Projection locale de `ActivityScheduled` (calendar-service), sur le modèle
 * établi par video-session-service (docs/services/video-session-service.md,
 * "Événements consommés — création automatique de salle") : `ActivityConfirmed`
 * ne porte que `{activityId, confirmedBy}`, pas assez pour décider d'agir sur une
 * activité de type `cours`. Ce service projette donc `ActivityScheduled` (qui
 * porte `type`, `creatorId`, `recipientId`) localement, et le relit à la
 * confirmation.
 */
@Entity('activity_projections')
export class ActivityProjection {
  /** UUID de l'activité (ScheduledActivity.id de calendar-service) */
  @PrimaryColumn({ name: 'activity_id' })
  activityId: string;

  /** cours | reunion_pedagogique | entretien_rp | rappel | autre */
  @Column()
  type: string;

  /** UUID du créateur de l'activité (le formateur, pour type=cours) */
  @Column({ name: 'creator_id' })
  creatorId: string;

  /**
   * UUID du destinataire unique quand `participantIds` n'a qu'un élément
   * (cas 1 proposeur -> 1 destinataire, systématique pour cours/FORMATEUR) ;
   * `null` pour les usages multi-participants.
   */
  @Column({ name: 'recipient_id', nullable: true })
  recipientId: string;

  @Column({ name: 'participant_ids', type: 'simple-json', nullable: true })
  participantIds: string[];

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
