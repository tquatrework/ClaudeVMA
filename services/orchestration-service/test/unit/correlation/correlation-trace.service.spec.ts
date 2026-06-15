import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CorrelationTraceService } from '../../../src/correlation/correlation-trace.service';
import { CorrelationTrace } from '../../../src/correlation/entities/correlation-trace.entity';

const makeRepoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'trace-1', ...x })),
  find: jest.fn(),
});

describe('CorrelationTraceService', () => {
  let service: CorrelationTraceService;
  let repo: ReturnType<typeof makeRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationTraceService,
        { provide: getRepositoryToken(CorrelationTrace), useFactory: makeRepoMock },
      ],
    }).compile();

    service = module.get(CorrelationTraceService);
    repo = module.get(getRepositoryToken(CorrelationTrace));
  });

  describe('record — ORCH-TRACE-001', () => {
    it('creates and saves a trace with all provided fields', async () => {
      await service.record('corr-1', 'workflow', 'WorkflowStarted', {
        entityId: 'wf-1',
        metadata: { stepCount: 5 },
        actor: 'user-42',
        isTiOverride: false,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'corr-1',
          entityType: 'workflow',
          action: 'WorkflowStarted',
          entityId: 'wf-1',
          metadata: { stepCount: 5 },
          actor: 'user-42',
          isTiOverride: false,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('defaults isTiOverride to false when not provided — ORCH-TRACE-002', async () => {
      await service.record('corr-2', 'workflow', 'WorkflowCompleted');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isTiOverride: false }),
      );
    });

    it('marks a TI override trace with isTiOverride: true — ORCH-TRACE-003', async () => {
      await service.record('corr-3', 'workflow', 'WorkflowResumed', {
        isTiOverride: true,
        actor: 'ti-admin',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isTiOverride: true, actor: 'ti-admin' }),
      );
    });
  });

  describe('findByCorrelation — ORCH-TRACE-004', () => {
    it('returns traces ordered chronologically by occurredAt', async () => {
      const traces = [
        { id: 't1', correlationId: 'corr-4' },
        { id: 't2', correlationId: 'corr-4' },
      ];
      repo.find.mockResolvedValue(traces);

      const result = await service.findByCorrelation('corr-4');

      expect(repo.find).toHaveBeenCalledWith({
        where: { correlationId: 'corr-4' },
        order: { occurredAt: 'ASC' },
      });
      expect(result).toEqual(traces);
    });

    it('returns empty array when no traces match correlationId', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByCorrelation('no-match');
      expect(result).toEqual([]);
    });
  });
});
