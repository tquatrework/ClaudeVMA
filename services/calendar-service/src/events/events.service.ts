import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvent } from './entities/domain-event.entity';
import { EventPublisher } from './event-publisher.service';

export type CalendarEventType =
  | 'AvailabilityUpdated'
  | 'ActivityScheduled'
  | 'ActivityUpdated'
  | 'ActivityDeleted'
  | 'ActivityConfirmed'
  | 'ActivityDeclined'
  | 'ReminderCreated'
  | 'CalendarEventCreated'
  | 'InvitationAccepted'
  | 'InvitationDeclined'
  | 'CancellationRequested';

export interface DomainEventShape {
  type: CalendarEventType;
  occurredAt: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

/**
 * Associe chaque `CalendarEventType` a son type d'agregat, et sait retrouver
 * l'identifiant de cet agregat dans le payload deja construit par
 * l'appelant. Ce n'est pas une nouvelle regle metier : c'est la meme
 * information que celle deja portee (informellement) par chaque payload
 * existant (`activityId`, `ownerId`, `eventId`, `reminderId`) — juste rendue
 * explicite pour remplir les colonnes `aggregate_type`/`aggregate_id` de
 * l'outbox.
 */
const AGGREGATE_TYPE_BY_EVENT: Record<CalendarEventType, string> = {
  AvailabilityUpdated: 'Calendar',
  ActivityScheduled: 'ScheduledActivity',
  ActivityUpdated: 'ScheduledActivity',
  ActivityDeleted: 'ScheduledActivity',
  ActivityConfirmed: 'ScheduledActivity',
  ActivityDeclined: 'ScheduledActivity',
  ReminderCreated: 'Reminder',
  CalendarEventCreated: 'CalendarEvent',
  InvitationAccepted: 'CalendarEvent',
  InvitationDeclined: 'CalendarEvent',
  CancellationRequested: 'CalendarEvent',
};

function extractAggregateId(payload: Record<string, unknown>): string {
  // Ordre du plus specifique au plus generique : un payload d'evenement lie
  // a une activite/rappel/evenement de calendrier porte toujours son propre
  // identifiant en plus, parfois, d'un `ownerId` de contexte (ex.
  // `ReminderCreated` porte `reminderId` ET `ownerId`) — c'est l'identifiant
  // specifique qui doit l'emporter.
  const candidate =
    payload.activityId ?? payload.eventId ?? payload.reminderId ?? payload.slotId ?? payload.ownerId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'unknown';
}

/**
 * Ecrit les evenements metier de `calendar-service` dans la boite d'envoi
 * (outbox), puis declenche leur remise au flux Redis `visiomath:events` via
 * `EventPublisher`.
 *
 * Avant le chantier calendrier de disponibilites, point 3 (2026-08-18),
 * `publish()` ecrivait UNE LIGNE DE LOG et rien d'autre : aucun bus, aucun
 * abonne — rien de ce que produisait ce service n'atteignait
 * `dashboard-notification-service`. Meme constat, et meme remede, que pour
 * `teacher-request-service` le 2026-08-12 (« un evenement qui n'est qu'un
 * `logger.log` n'est pas un evenement »).
 *
 * La signature publique `publish(type, payload, correlationId): void` reste
 * IDENTIQUE a celle du stub qu'elle remplace : les treize points d'appel
 * existants (`CalendarsService`, `ActivitiesService`, `RemindersService`,
 * `CalendarEventsService`) n'ont pas a etre modifies. L'ecriture en base est
 * asynchrone et volontairement non bloquante pour l'appelant (comme l'etait
 * deja le `logger.log` qu'elle remplace) : chaque appelant publie deja
 * strictement apres la resolution de sa propre transaction (voir les
 * commentaires « Published after commit » dans `CalendarsService` et
 * `CalendarEventsService`), donc l'ecriture de l'evenement n'a pas besoin de
 * partager cette transaction pour rester coherente avec l'etat qu'elle
 * annonce.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(DomainEvent) private readonly eventRepo: Repository<DomainEvent>,
    private readonly publisher: EventPublisher,
  ) {}

  publish(
    type: CalendarEventType,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): void {
    void this.persistAndSchedule(type, payload, correlationId);
  }

  private async persistAndSchedule(
    type: CalendarEventType,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    try {
      const domainEvent = this.eventRepo.create({
        eventName: type,
        aggregateType: AGGREGATE_TYPE_BY_EVENT[type],
        aggregateId: extractAggregateId(payload),
        payload,
        correlationId: correlationId ?? null,
        publishedAt: null,
        publishAttempts: 0,
      });
      const saved = await this.eventRepo.save(domainEvent);
      this.logger.log(`${type} enregistre (${saved.aggregateType} ${saved.aggregateId})`);
      this.publisher.scheduleFlush();
    } catch (error) {
      this.logger.error(
        `Echec d'enregistrement de l'evenement ${type} : ${(error as Error).message}`,
      );
    }
  }
}
