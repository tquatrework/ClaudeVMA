import { Injectable, Logger } from '@nestjs/common';

export type ProfileEventType =
  | 'ProfileUpdated'
  | 'StudentLinkedToFinanceOwner'
  /**
   * Rupture d'un lien parent financeur ↔ élève (besoin du 2026-08-11).
   * Pendant obligatoire de `StudentLinkedToFinanceOwner` : publier la liaison
   * sans publier la rupture laisserait tout abonné futur sur une vue périmée.
   * Aucun consommateur à ce jour — la publication reste un journal structuré,
   * comme pour les autres événements de ce service.
   */
  | 'StudentUnlinkedFromFinanceOwner'
  | 'TeacherLinkedToStudent'
  /**
   * Fin d'une relation élève ↔ formateur, prononcée par un RP (arbitrage du
   * 2026-08-12). Pendant obligatoire de `TeacherLinkedToStudent`, pour la même
   * raison que ci-dessus : publier l'affectation sans publier sa fin laisserait
   * tout abonné futur sur une vue périmée — et ici la vue périmée porterait des
   * DROITS (statistiques, archives pédagogiques), pas seulement un affichage.
   * Charge utile : `{teacherId, studentId, actorId, endedAt, reason}` — `reason`
   * vaut `null` quand le RP n'en a pas consigné.
   */
  | 'TeacherUnlinkedFromStudent'
  | 'CoordinatorLinkedToStudent'
  /** AP rattaché à un formateur qu'il anime (arbitrage du 2026-08-11). */
  | 'AnimatorLinkedToTeacher'
  | 'TeacherPromotedToPedagogicalAnimator'
  | 'TeacherValidated'
  /**
   * Reprise de candidature après un refus formateur (arbitrage du 2026-08-13) :
   * le formateur relance lui-même son dossier, une fois l'échéance atteinte.
   * Distinct de `TeacherValidated` — cet événement signale la création d'une
   * nouvelle ligne `pending`, pas une validation.
   */
  | 'TeacherValidationReapplied'
  | 'AdminProfileReminderCreated';

export interface DomainEvent {
  type: ProfileEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/**
 * Stub event publisher for Phase 1.
 * Structured JSON logs make events observable in the meantime;
 * a real message broker (RabbitMQ / Kafka) can be wired in Phase 2
 * by replacing this implementation without changing callers.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('DomainEvents');

  publish(type: ProfileEventType, payload: Record<string, unknown>): void {
    const event: DomainEvent = { type, occurredAt: new Date().toISOString(), payload };
    this.logger.log(JSON.stringify(event));
  }
}
