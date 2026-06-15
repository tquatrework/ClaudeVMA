import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommandService } from '../../../src/command/command.service';
import { IntegrationCommand } from '../../../src/command/entities/integration-command.entity';
import { HttpClientService } from '../../../src/http-client/http-client.service';
import { IdempotencyService } from '../../../src/idempotency/idempotency.service';

const makeRepoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'cmd-1', ...x })),
  findOne: jest.fn(),
  find: jest.fn(),
});

const makeHttpClientMock = () => ({
  call: jest.fn(),
  buildStepIdempotencyKey: jest.fn(),
});

const makeIdempotencyMock = () => ({
  check: jest.fn().mockResolvedValue(null),
  register: jest.fn().mockResolvedValue(undefined),
});

describe('CommandService', () => {
  let service: CommandService;
  let repo: ReturnType<typeof makeRepoMock>;
  let httpClient: ReturnType<typeof makeHttpClientMock>;
  let idempotency: ReturnType<typeof makeIdempotencyMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandService,
        { provide: getRepositoryToken(IntegrationCommand), useFactory: makeRepoMock },
        { provide: HttpClientService, useFactory: makeHttpClientMock },
        { provide: IdempotencyService, useFactory: makeIdempotencyMock },
      ],
    }).compile();

    service = module.get(CommandService);
    repo = module.get(getRepositoryToken(IntegrationCommand));
    httpClient = module.get(HttpClientService);
    idempotency = module.get(IdempotencyService);
  });

  describe('dispatch — ORCH-CMD-001', () => {
    it('dispatches a command successfully and registers idempotency key', async () => {
      const dto = {
        idempotencyKey: 'cmd-abc',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: { accountId: 'acc-1' },
      };
      httpClient.call.mockResolvedValue({ success: true, data: { profileId: 'p-1' } });

      const result = await service.dispatch(dto);

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(httpClient.call).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'profile-service',
          action: 'create-student-profiles',
          idempotencyKey: 'cmd-abc',
        }),
      );
      expect(idempotency.register).toHaveBeenCalledWith('cmd-abc', { profileId: 'p-1' });
      expect(result.dispatched).toBe(true);
    });

    it('records error and does not register idempotency key on HTTP failure — ORCH-CMD-002', async () => {
      const dto = {
        idempotencyKey: 'cmd-fail',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: {},
      };
      httpClient.call.mockResolvedValue({ success: false, error: 'Service unavailable' });

      const result = await service.dispatch(dto);

      expect(result.dispatched).toBe(false);
      expect(result.error).toBe('Service unavailable');
      expect(idempotency.register).not.toHaveBeenCalled();
    });

    it('returns cached command without HTTP call when idempotency key exists — ORCH-CMD-003', async () => {
      const dto = {
        idempotencyKey: 'cmd-cached',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: {},
      };
      const cached = { id: 'cmd-existing', idempotencyKey: 'cmd-cached', dispatched: true };
      idempotency.check.mockResolvedValue({ profileId: 'p-cached' });
      repo.findOne.mockResolvedValue(cached);

      const result = await service.dispatch(dto);

      expect(httpClient.call).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('generates a correlationId when none is provided — ORCH-CMD-004', async () => {
      const dto = {
        idempotencyKey: 'cmd-nocorr',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: {},
      };
      httpClient.call.mockResolvedValue({ success: true, data: {} });

      await service.dispatch(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: expect.any(String) }),
      );
    });

    it('uses provided correlationId when given — ORCH-CMD-005', async () => {
      const dto = {
        idempotencyKey: 'cmd-withcorr',
        targetService: 'profile-service',
        action: 'create-student-profiles',
        payload: {},
        correlationId: 'my-corr-id',
      };
      httpClient.call.mockResolvedValue({ success: true, data: {} });

      await service.dispatch(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'my-corr-id' }),
      );
    });
  });

  describe('findByCorrelation — ORCH-CMD-006', () => {
    it('returns commands ordered by createdAt ascending', async () => {
      const commands = [
        { id: 'c1', correlationId: 'corr-x', createdAt: new Date('2024-01-01') },
        { id: 'c2', correlationId: 'corr-x', createdAt: new Date('2024-01-02') },
      ];
      repo.find.mockResolvedValue(commands);

      const result = await service.findByCorrelation('corr-x');

      expect(repo.find).toHaveBeenCalledWith({
        where: { correlationId: 'corr-x' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(commands);
    });

    it('returns empty array when no commands match correlationId', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByCorrelation('unknown-corr');
      expect(result).toEqual([]);
    });
  });
});
