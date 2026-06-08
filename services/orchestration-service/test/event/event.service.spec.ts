import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventService } from '../../src/event/event.service';
import { IntegrationEvent, EventDirection } from '../../src/event/entities/integration-event.entity';

const makeRepoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'evt-1', ...x })),
  update: jest.fn(),
  find: jest.fn(),
});

describe('EventService', () => {
  let service: EventService;
  let repo: ReturnType<typeof makeRepoMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(IntegrationEvent), useFactory: makeRepoMock },
      ],
    }).compile();

    service = module.get(EventService);
    repo = module.get(getRepositoryToken(IntegrationEvent));
  });

  describe('record — ORCH-EVT-001', () => {
    it('creates and saves an integration event with correct fields', async () => {
      const result = await service.record(
        'WorkflowStarted',
        'corr-1',
        EventDirection.PUBLISHED,
        { workflowInstanceId: 'wf-1' },
        'orchestration-service',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'WorkflowStarted',
          correlationId: 'corr-1',
          direction: EventDirection.PUBLISHED,
          payload: { workflowInstanceId: 'wf-1' },
          sourceService: 'orchestration-service',
          processed: false,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('records a CONSUMED event without a sourceService — ORCH-EVT-002', async () => {
      await service.record('AccountCreated', 'corr-2', EventDirection.CONSUMED, { accountId: 'a1' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: EventDirection.CONSUMED,
          sourceService: undefined,
        }),
      );
    });
  });

  describe('markProcessed — ORCH-EVT-003', () => {
    it('calls update with processed: true for the given id', async () => {
      repo.update.mockResolvedValue({});
      await service.markProcessed('evt-99');
      expect(repo.update).toHaveBeenCalledWith('evt-99', { processed: true });
    });
  });

  describe('findByCorrelation — ORCH-EVT-004', () => {
    it('returns events ordered chronologically by occurredAt', async () => {
      const events = [
        { id: 'e1', correlationId: 'corr-3' },
        { id: 'e2', correlationId: 'corr-3' },
      ];
      repo.find.mockResolvedValue(events);

      const result = await service.findByCorrelation('corr-3');

      expect(repo.find).toHaveBeenCalledWith({
        where: { correlationId: 'corr-3' },
        order: { occurredAt: 'ASC' },
      });
      expect(result).toEqual(events);
    });

    it('returns empty array when no events match correlationId', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findByCorrelation('no-match');
      expect(result).toEqual([]);
    });
  });
});
