import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationEvent, EventDirection } from './entities/integration-event.entity';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly repo: Repository<IntegrationEvent>,
  ) {}

  async record(
    eventType: string,
    correlationId: string,
    direction: EventDirection,
    payload: Record<string, any>,
    sourceService?: string,
  ): Promise<IntegrationEvent> {
    const event = this.repo.create({
      eventType,
      correlationId,
      direction,
      payload,
      sourceService,
      processed: false,
    });
    await this.repo.save(event);
    this.logger.log(`[${correlationId}] Event ${direction}:${eventType} recorded`);
    return event;
  }

  async markProcessed(id: string): Promise<void> {
    await this.repo.update(id, { processed: true });
  }

  async findByCorrelation(correlationId: string): Promise<IntegrationEvent[]> {
    return this.repo.find({
      where: { correlationId },
      order: { occurredAt: 'ASC' },
    });
  }
}
