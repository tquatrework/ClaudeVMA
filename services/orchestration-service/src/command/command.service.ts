import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { IntegrationCommand } from './entities/integration-command.entity';
import { HttpClientService } from '../http-client/http-client.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { DispatchCommandDto } from './dto/dispatch-command.dto';

@Injectable()
export class CommandService {
  constructor(
    @InjectRepository(IntegrationCommand)
    private readonly repo: Repository<IntegrationCommand>,
    private readonly httpClient: HttpClientService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async dispatch(dto: DispatchCommandDto): Promise<IntegrationCommand> {
    const cached = await this.idempotency.check(dto.idempotencyKey);
    if (cached) {
      const existing = await this.repo.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
    }

    const corrId = dto.correlationId ?? uuidv4();
    const command = this.repo.create({
      idempotencyKey: dto.idempotencyKey,
      targetService: dto.targetService,
      action: dto.action,
      correlationId: corrId,
      payload: dto.payload,
      dispatched: false,
    });
    await this.repo.save(command);

    const result = await this.httpClient.call({
      service: dto.targetService,
      action: dto.action,
      payload: dto.payload,
      correlationId: corrId,
      idempotencyKey: dto.idempotencyKey,
    });

    command.dispatched = result.success;
    command.result = result.data ?? null;
    command.error = result.error ?? null;
    command.dispatchedAt = new Date();
    await this.repo.save(command);

    if (result.success) {
      await this.idempotency.register(dto.idempotencyKey, result.data ?? {});
    }

    return command;
  }

  async findByCorrelation(correlationId: string): Promise<IntegrationCommand[]> {
    return this.repo.find({ where: { correlationId }, order: { createdAt: 'ASC' } });
  }
}
