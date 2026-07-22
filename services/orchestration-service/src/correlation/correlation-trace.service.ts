import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrelationTrace } from './entities/correlation-trace.entity';
import { MAX_CORRELATION_RESULTS } from '../common/constants/pagination.constant';

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
    options: { entityId?: string; metadata?: Record<string, any>; actor?: string; isTiOverride?: boolean } = {},
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        correlationId,
        entityType,
        action,
        entityId: options.entityId,
        metadata: options.metadata,
        actor: options.actor,
        isTiOverride: options.isTiOverride ?? false,
      }),
    );
  }

  async findByCorrelation(correlationId: string): Promise<CorrelationTrace[]> {
    return this.repo.find({
      where: { correlationId },
      order: { occurredAt: 'ASC' },
      take: MAX_CORRELATION_RESULTS,
    });
  }
}
