import { Injectable, Logger } from '@nestjs/common';

export type FinanceEventType =
  | 'PaymentConfirmed'
  | 'InvoiceIssued'
  | 'TeacherPaymentRequested'
  | 'TeacherPaymentValidated'
  | 'PaymentIncidentDetected'
  | 'RewardSettingUpdated'
  | 'PointsDebited'
  | 'PointsCredited';

export interface DomainEvent {
  type: FinanceEventType;
  occurredAt: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

/**
 * Stub event publisher for Phase 1/2.
 * Structured logs make events observable; a real message broker can be wired later.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('DomainEvents');

  publish(
    type: FinanceEventType,
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
