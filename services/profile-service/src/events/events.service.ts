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
  | 'CoordinatorLinkedToStudent'
  /** AP rattaché à un formateur qu'il anime (arbitrage du 2026-08-11). */
  | 'AnimatorLinkedToTeacher'
  | 'TeacherPromotedToPedagogicalAnimator'
  | 'TeacherValidated'
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
