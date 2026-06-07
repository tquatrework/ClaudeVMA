import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrelationTrace } from './entities/correlation-trace.entity';

@Injectable()
export class CorrelationTraceService {
  constructor(
    @InjectRepository(CorrelationTrace)
    private readonly repo: Repository<CorrelationTrace>,
  ) {}

  async record(
    correlationId: string,
    entityType: string,
    action: string,
    opts: { entityId?: string; metadata?: Record<string, any>; actor?: string; isTiOverride?: boolean } = {},
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        correlationId,
        entityType,
        action,
        entityId: opts.entityId,
        metadata: opts.metadata,
        actor: opts.actor,
        isTiOverride: opts.isTiOverride ?? false,
      }),
    );
  }

  async findByCorrelation(correlationId: string): Promise<CorrelationTrace[]> {
    return this.repo.find({ where: { correlationId }, order: { occurredAt: 'ASC' } });
  }
}
