import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdempotencyService } from '../../../src/idempotency/idempotency.service';
import { IdempotencyKey } from '../../../src/idempotency/entities/idempotency-key.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyKey), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
    repo = module.get(getRepositoryToken(IdempotencyKey));
  });

  it('returns null when key does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.check('missing-key');
    expect(result).toBeNull();
  });

  it('returns cached response when key exists and is not expired', async () => {
    const future = new Date(Date.now() + 3600 * 1000);
    repo.findOne.mockResolvedValue({ key: 'k1', responseSnapshot: { id: 'abc' }, expiresAt: future });
    const result = await service.check('k1');
    expect(result).toEqual({ id: 'abc' });
  });

  it('deletes and returns null when key is expired', async () => {
    const past = new Date(Date.now() - 1000);
    repo.findOne.mockResolvedValue({ key: 'k2', responseSnapshot: { id: 'old' }, expiresAt: past });
    repo.delete.mockResolvedValue({});
    const result = await service.check('k2');
    expect(result).toBeNull();
    expect(repo.delete).toHaveBeenCalledWith({ key: 'k2' });
  });

  it('upserts a new key on register', async () => {
    repo.upsert.mockResolvedValue({});
    await service.register('new-key', { accountId: '123' });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'new-key', responseSnapshot: { accountId: '123' } }),
      ['key'],
    );
  });
});
