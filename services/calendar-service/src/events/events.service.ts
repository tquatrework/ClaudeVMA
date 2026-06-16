import { Injectable, Logger } from '@nestjs/common';

export type CalendarEventType =
  | 'AvailabilityUpdated'
  | 'ActivityScheduled'
  | 'ActivityUpdated'
  | 'ReminderCreated'
  | 'CalendarEventCreated'
  | 'InvitationAccepted'
  | 'InvitationDeclined'
  | 'CancellationRequested'
  | 'ReminderDue';

export interface DomainEvent {
  type: CalendarEventType;
  occurredAt: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

/**
 * Stub event publisher for Phase 1.
 * Structured logs make events observable; a real message broker (RabbitMQ / Kafka)
 * can be wired in Phase 2 by replacing this implementation.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('DomainEvents');

  publish(
    type: CalendarEventType,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): void {
    const event: DomainEvent = {
      type,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload,
    };
    this.logger.log(JSON.stringify(event));
  }
}
