import { Injectable, Logger } from '@nestjs/common';

export type DomainEventType =
  | 'AccountCreated'
  | 'RoleChanged'
  | 'ConsentSigned'
  | 'AccountValidated'
  | 'AccountSuspended'
  | 'PasswordResetRequested'
  | 'AccessRegenerated'
  | 'DelegatedAccessGranted';

export interface DomainEvent {
  type: DomainEventType;
  occurredAt: string;
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

  publish(type: DomainEventType, payload: Record<string, unknown>): void {
    const event: DomainEvent = { type, occurredAt: new Date().toISOString(), payload };
    this.logger.log(JSON.stringify(event));
  }
}
