import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async check(key: string): Promise<Record<string, any> | null> {
    const record = await this.repo.findOne({ where: { key } });
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) {
      await this.repo.delete({ key });
      return null;
    }
    return record.responseSnapshot;
  }

  async register(key: string, response: Record<string, any>, ttlHours = 24): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);
    await this.repo.upsert({ key, responseSnapshot: response, expiresAt }, ['key']);
  }
}
