import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkflowEngineService } from '../../src/workflow/workflow-engine.service';
import { WorkflowInstance } from '../../src/workflow/entities/workflow-instance.entity';
import { WorkflowStep } from '../../src/workflow/entities/workflow-step.entity';
import { CompensationAction } from '../../src/workflow/entities/compensation-action.entity';
import { RetryPolicy } from '../../src/workflow/entities/retry-policy.entity';
import { HttpClientService } from '../../src/http-client/http-client.service';
import { IdempotencyService } from '../../src/idempotency/idempotency.service';
import { EventService } from '../../src/event/event.service';
import { CorrelationTraceService } from '../../src/correlation/correlation-trace.service';
import { WorkflowStatus } from '../../src/common/enums/workflow-status.enum';
import { StepStatus } from '../../src/common/enums/step-status.enum';

const makeRepoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'inst-1', ...x })),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const makeHttpClientMock = () => ({
  call: jest.fn(),
  buildStepIdempotencyKey: jest.fn((id, order) => `wf:${id}:step:${order}`),
});

const makeIdempotencyMock = () => ({
  check: jest.fn().mockResolvedValue(null),
  register: jest.fn().mockResolvedValue(undefined),
});

const makeEventServiceMock = () => ({
  record: jest.fn().mockResolvedValue(undefined),
});

const makeCorrelationTraceMock = () => ({
  record: jest.fn().mockResolvedValue(undefined),
});

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let instanceRepo: ReturnType<typeof makeRepoMock>;
  let stepRepo: ReturnType<typeof makeRepoMock>;
  let compensationRepo: ReturnType<typeof makeRepoMock>;
  let retryRepo: ReturnType<typeof makeRepoMock>;
  let httpClient: ReturnType<typeof makeHttpClientMock>;
  let idempotency: ReturnType<typeof makeIdempotencyMock>;
  let eventService: ReturnType<typeof makeEventServiceMock>;
  let correlationTrace: ReturnType<typeof makeCorrelationTraceMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowInstance), useFactory: makeRepoMock },
        { provide: getRepositoryToken(WorkflowStep), useFactory: makeRepoMock },
        { provide: getRepositoryToken(CompensationAction), useFactory: makeRepoMock },
        { provide: getRepositoryToken(RetryPolicy), useFactory: makeRepoMock },
        { provide: HttpClientService, useFactory: makeHttpClientMock },
        { provide: IdempotencyService, useFactory: makeIdempotencyMock },
        { provide: EventService, useFactory: makeEventServiceMock },
        { provide: CorrelationTraceService, useFactory: makeCorrelationTraceMock },
      ],
    }).compile();

    engine = module.get(WorkflowEngineService);
    instanceRepo = module.get(getRepositoryToken(WorkflowInstance));
    stepRepo = module.get(getRepositoryToken(WorkflowStep));
    compensationRepo = module.get(getRepositoryToken(CompensationAction));
    retryRepo = module.get(getRepositoryToken(RetryPolicy));
    httpClient = module.get(HttpClientService);
    idempotency = module.get(IdempotencyService);
    eventService = module.get(EventService);
    correlationTrace = module.get(CorrelationTraceService);
  });

  describe('startWorkflow', () => {
    it('throws for unknown workflow type', async () => {
      await expect(engine.startWorkflow('unknown-type', {})).rejects.toThrow(
        'Unknown workflow type: unknown-type',
      );
    });

    it('creates instance and publishes WorkflowStarted event', async () => {
      instanceRepo.save.mockResolvedValue({
        id: 'inst-1', correlationId: 'corr-1',
        status: WorkflowStatus.IN_PROGRESS, payload: {}, context: {},
      });
      stepRepo.save.mockResolvedValue([]);

      await engine.startWorkflow('student-onboarding', { email: 'a@b.com' });

      expect(instanceRepo.save).toHaveBeenCalled();
      expect(eventService.record).toHaveBeenCalledWith(
        'WorkflowStarted', expect.any(String), expect.any(String), expect.any(Object),
      );
    });
  });

  describe('executeWorkflow', () => {
    it('marks workflow completed when all steps succeed', async () => {
      const mockInstance = {
        id: 'inst-1', workflowType: 'student-onboarding', correlationId: 'corr-1',
        payload: { email: 'x@y.com', consents: [] }, context: {}, status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [{
        id: 's1', stepOrder: 1, stepName: 'create-student-account',
        targetService: 'identity-access-service', action: 'create-account',
        status: StepStatus.PENDING, idempotencyKey: 'wf:inst-1:step:1',
      }];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      compensationRepo.save.mockResolvedValue({});
      compensationRepo.create.mockImplementation((x) => x);
      httpClient.call.mockResolvedValue({ success: true, data: { accountId: 'acc-99' } });

      await engine.executeWorkflow('inst-1');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-1', { status: WorkflowStatus.COMPLETED });
      expect(eventService.record).toHaveBeenCalledWith(
        'WorkflowStepCompleted', 'corr-1', expect.any(String), expect.any(Object),
      );
    });

    it('runs compensation and marks COMPENSATED when a required step fails', async () => {
      const mockInstance = {
        id: 'inst-2', workflowType: 'student-onboarding', correlationId: 'corr-2',
        payload: { email: 'x@y.com', consents: [] }, context: {}, status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [{
        id: 's2', stepOrder: 1, stepName: 'create-student-account',
        targetService: 'identity-access-service', action: 'create-account',
        status: StepStatus.PENDING, idempotencyKey: 'wf:inst-2:step:1',
      }];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      compensationRepo.find.mockResolvedValue([]);
      httpClient.call.mockResolvedValue({ success: false, error: 'Service unavailable' });

      await engine.executeWorkflow('inst-2');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-2', expect.objectContaining({
        status: WorkflowStatus.COMPENSATING,
      }));
      expect(instanceRepo.update).toHaveBeenCalledWith('inst-2', { status: WorkflowStatus.COMPENSATED });
      expect(eventService.record).toHaveBeenCalledWith(
        'WorkflowFailed', 'corr-2', expect.any(String), expect.any(Object),
      );
    });

    it('skips optional steps that fail and completes the workflow', async () => {
      const mockInstance = {
        id: 'inst-3', workflowType: 'teacher-onboarding', correlationId: 'corr-3',
        payload: { email: 't@t.com', consents: [], subjects: [], levels: [] }, context: {},
        status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [
        { id: 's3', stepOrder: 1, stepName: 'create-teacher-account', targetService: 'identity-access-service', action: 'create-account', status: StepStatus.COMPLETED, idempotencyKey: 'wf:inst-3:step:1', output: { accountId: 'acc-t1' } },
        { id: 's4', stepOrder: 2, stepName: 'create-teacher-profiles', targetService: 'profile-service', action: 'create-teacher-profiles', status: StepStatus.COMPLETED, idempotencyKey: 'wf:inst-3:step:2', output: { profileId: 'p1' } },
        { id: 's5', stepOrder: 3, stepName: 'init-financial-profile', targetService: 'finance-credit-service', action: 'init-teacher-financial-profile', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:3' },
        { id: 's6', stepOrder: 4, stepName: 'trigger-teacher-contract', targetService: 'legal-document-service', action: 'create-teacher-contract', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:4' },
        { id: 's7', stepOrder: 5, stepName: 'notify-rp-for-validation', targetService: 'dashboard-notification-service', action: 'notify-teacher-pending-validation', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:5' },
      ];

      instanceRepo.findOne
        .mockResolvedValueOnce(mockInstance)
        .mockResolvedValueOnce({ ...mockInstance, status: WorkflowStatus.IN_PROGRESS });
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      httpClient.call
        .mockResolvedValueOnce({ success: false, error: 'finance not ready' })
        .mockResolvedValueOnce({ success: false, error: 'legal not ready' })
        .mockResolvedValueOnce({ success: true, data: { notified: true } });

      await engine.executeWorkflow('inst-3');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-3', { status: WorkflowStatus.COMPLETED });
    });

    it('reuses idempotent output without calling HTTP again', async () => {
      const mockInstance = {
        id: 'inst-4', workflowType: 'student-onboarding', correlationId: 'corr-4',
        payload: { email: 'z@z.com', consents: [] }, context: {}, status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [{
        id: 's8', stepOrder: 1, stepName: 'create-student-account',
        targetService: 'identity-access-service', action: 'create-account',
        status: StepStatus.PENDING, idempotencyKey: 'wf:inst-4:step:1',
      }];

      instanceRepo.findOne
        .mockResolvedValueOnce(mockInstance)
        .mockResolvedValueOnce({ ...mockInstance, status: WorkflowStatus.IN_PROGRESS });
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      idempotency.check.mockResolvedValue({ accountId: 'cached-acc' });

      await engine.executeWorkflow('inst-4');

      expect(httpClient.call).not.toHaveBeenCalled();
      expect(instanceRepo.update).toHaveBeenCalledWith('inst-4', { status: WorkflowStatus.COMPLETED });
    });

    it('retries a failing step up to maxAttempts before failing', async () => {
      const mockInstance = {
        id: 'inst-5', workflowType: 'student-onboarding', correlationId: 'corr-5',
        payload: { email: 'r@r.com', consents: [] }, context: {}, status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [{
        id: 's9', stepOrder: 1, stepName: 'create-student-account',
        targetService: 'identity-access-service', action: 'create-account',
        status: StepStatus.PENDING, idempotencyKey: 'wf:inst-5:step:1',
      }];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      retryRepo.create.mockImplementation((x) => x);
      retryRepo.save.mockResolvedValue({});
      compensationRepo.find.mockResolvedValue([]);
      // 3 attempts (maxAttempts in student-onboarding step 1), all fail
      httpClient.call.mockResolvedValue({ success: false, error: 'timeout' });

      await engine.executeWorkflow('inst-5');

      expect(httpClient.call).toHaveBeenCalledTimes(3);
      expect(instanceRepo.update).toHaveBeenCalledWith('inst-5', expect.objectContaining({
        status: WorkflowStatus.COMPENSATING,
      }));
    });
  });

  describe('suspendForArbitration / resumeAfterArbitration', () => {
    it('suspends a workflow and records a CorrelationTrace', async () => {
      instanceRepo.findOne.mockResolvedValue({
        id: 'inst-6', correlationId: 'corr-6', status: WorkflowStatus.IN_PROGRESS,
      });

      await engine.suspendForArbitration('inst-6', 'accord utilisateur requis', 'user-123');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-6', {
        status: WorkflowStatus.NEEDS_ARBITRATION,
        error: 'accord utilisateur requis',
      });
      expect(correlationTrace.record).toHaveBeenCalledWith(
        'corr-6', 'workflow', 'WorkflowSuspendedForArbitration',
        expect.objectContaining({ actor: 'user-123' }),
      );
    });

    it('resumes a workflow and marks TI override in trace when tiOverride=true', async () => {
      instanceRepo.findOne.mockResolvedValue({
        id: 'inst-7', correlationId: 'corr-7', status: WorkflowStatus.NEEDS_ARBITRATION,
        workflowType: 'student-onboarding', payload: {}, context: {},
      });
      stepRepo.find.mockResolvedValue([]);

      await engine.resumeAfterArbitration('inst-7', 'ti-admin', true);

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-7', {
        status: WorkflowStatus.IN_PROGRESS, error: null,
      });
      expect(correlationTrace.record).toHaveBeenCalledWith(
        'corr-7', 'workflow', 'WorkflowResumed',
        expect.objectContaining({ isTiOverride: true, actor: 'ti-admin' }),
      );
    });
  });
});
