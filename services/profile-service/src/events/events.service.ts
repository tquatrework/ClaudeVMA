import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEventOutbox } from './domain-event-outbox.entity';

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
  | 'AdminProfileReminderCreated';

export interface DomainEvent {
  type: ProfileEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/**
 * Publieur d'événements de domaine.
 *
 * DEPUIS LE 2026-09-04 : `publish()` ne se contente plus d'un `logger.log()`.
 * Chaque appel écrit AUSSI une ligne dans l'outbox `domain_events`
 * (`DomainEventOutbox`), balayée par `EventPublisherService` pour un `XADD`
 * réel sur le stream Redis `visiomath:events` — même pattern que celui déjà
 * construit pour `teacher-request-service` (arbitrage du 2026-08-14). Avant
 * ce chantier, ce service journalisait ses événements mais ne les publiait
 * jamais sur le bus : `communication-service`, qui a construit un
 * consommateur complet pour dériver des contacts par défaut, a constaté en
 * lisant directement le stream réel qu'aucun événement de `profile-service`
 * n'y figurait jamais (rapport de session du 2026-09-04).
 *
 * Le log reste : il donne une trace immédiate et lisible en observabilité,
 * indépendante de la disponibilité de Redis ou de l'exécution du balayage.
 *
 * NON BLOQUANT : l'écriture en base est `await`ée par l'appelant (le service
 * refuse de démarrer sans `DATABASE_URL`, cette dépendance est donc toujours
 * disponible), mais `publish()` ne dépend JAMAIS de Redis — c'est
 * `EventPublisherService`, découplé, qui s'en charge en arrière-plan. Une
 * indisponibilité Redis ne fait donc jamais échouer une écriture métier.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('DomainEvents');

  constructor(
    @InjectRepository(DomainEventOutbox)
    private readonly outboxRepo: Repository<DomainEventOutbox>,
  ) {}

  async publish(type: ProfileEventType, payload: Record<string, unknown>): Promise<void> {
    const occurredAt = new Date();
    const event: DomainEvent = { type, occurredAt: occurredAt.toISOString(), payload };
    this.logger.log(JSON.stringify(event));

    try {
      const row = this.outboxRepo.create({ type, payload, occurredAt });
      await this.outboxRepo.save(row);
    } catch (err) {
      // Un échec d'écriture de l'outbox ne doit jamais faire remonter une
      // erreur à l'appelant métier : la ligne de log ci-dessus reste la
      // trace de dernier recours, comme avant ce chantier. Journalisé en
      // erreur pour rester visible en observabilité.
      this.logger.error(
        `Échec de l'écriture de l'outbox pour l'événement ${type} : ${(err as Error).message}. ` +
          "Cet événement ne sera publié sur le bus qu'après diagnostic de cet échec.",
      );
    }
  }
}
