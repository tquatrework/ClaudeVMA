import { Injectable, Logger } from '@nestjs/common';

export type ProfileEventType =
  | 'ProfileUpdated'
  | 'StudentLinkedToFinanceOwner'
  | 'TeacherLinkedToStudent'
  | 'TeacherPromotedToPedagogicalAnimator';

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
