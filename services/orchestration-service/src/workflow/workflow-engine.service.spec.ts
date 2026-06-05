import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowInstance } from './entities/workflow-instance.entity';
import { WorkflowStep } from './entities/workflow-step.entity';
import { HttpClientService } from '../http-client/http-client.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { WorkflowStatus } from '../common/enums/workflow-status.enum';
import { StepStatus } from '../common/enums/step-status.enum';

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

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let instanceRepo: ReturnType<typeof makeRepoMock>;
  let stepRepo: ReturnType<typeof makeRepoMock>;
  let httpClient: ReturnType<typeof makeHttpClientMock>;
  let idempotency: ReturnType<typeof makeIdempotencyMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEngineService,
        { provide: getRepositoryToken(WorkflowInstance), useFactory: makeRepoMock },
        { provide: getRepositoryToken(WorkflowStep), useFactory: makeRepoMock },
        { provide: HttpClientService, useFactory: makeHttpClientMock },
        { provide: IdempotencyService, useFactory: makeIdempotencyMock },
      ],
    }).compile();

    engine = module.get(WorkflowEngineService);
    instanceRepo = module.get(getRepositoryToken(WorkflowInstance));
    stepRepo = module.get(getRepositoryToken(WorkflowStep));
    httpClient = module.get(HttpClientService);
    idempotency = module.get(IdempotencyService);
  });

  describe('startWorkflow', () => {
    it('throws for unknown workflow type', async () => {
      await expect(engine.startWorkflow('unknown-type', {})).rejects.toThrow(
        'Unknown workflow type: unknown-type',
      );
    });

    it('creates instance and steps for student-onboarding', async () => {
      instanceRepo.save.mockResolvedValue({ id: 'inst-1', correlationId: 'corr-1', status: WorkflowStatus.IN_PROGRESS, payload: {}, context: {} });
      stepRepo.save.mockResolvedValue([]);

      const instance = await engine.startWorkflow('student-onboarding', { email: 'a@b.com' });

      expect(instanceRepo.save).toHaveBeenCalled();
      expect(stepRepo.save).toHaveBeenCalled();
      expect(instance.status).toBe(WorkflowStatus.IN_PROGRESS);
    });
  });

  describe('executeWorkflow', () => {
    it('marks workflow completed when all steps succeed', async () => {
      const mockInstance = {
        id: 'inst-1',
        workflowType: 'student-onboarding',
        correlationId: 'corr-1',
        payload: { email: 'x@y.com', consents: [] },
        context: {},
        status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [
        { id: 's1', stepOrder: 1, stepName: 'create-student-account', targetService: 'identity-access-service', action: 'create-account', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-1:step:1' },
      ];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      httpClient.call.mockResolvedValue({ success: true, data: { accountId: 'acc-99' } });

      await engine.executeWorkflow('inst-1');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-1', { status: WorkflowStatus.COMPLETED });
    });

    it('marks workflow failed when a required step fails', async () => {
      const mockInstance = {
        id: 'inst-2',
        workflowType: 'student-onboarding',
        correlationId: 'corr-2',
        payload: { email: 'x@y.com', consents: [] },
        context: {},
        status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [
        { id: 's2', stepOrder: 1, stepName: 'create-student-account', targetService: 'identity-access-service', action: 'create-account', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-2:step:1' },
      ];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      httpClient.call.mockResolvedValue({ success: false, error: 'Service unavailable' });

      await engine.executeWorkflow('inst-2');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-2', {
        status: WorkflowStatus.FAILED,
        error: expect.stringContaining('create-student-account'),
      });
    });

    it('skips optional steps that fail and continues', async () => {
      const mockInstance = {
        id: 'inst-3',
        workflowType: 'teacher-onboarding',
        correlationId: 'corr-3',
        payload: { email: 't@t.com', consents: [], subjects: [], levels: [] },
        context: {},
        status: WorkflowStatus.IN_PROGRESS,
      };
      // Only return the optional step (init-financial-profile, order=3) as pending
      const mockSteps = [
        { id: 's3', stepOrder: 1, stepName: 'create-teacher-account', targetService: 'identity-access-service', action: 'create-account', status: StepStatus.COMPLETED, idempotencyKey: 'wf:inst-3:step:1', output: { accountId: 'acc-t1' } },
        { id: 's4', stepOrder: 2, stepName: 'create-teacher-profiles', targetService: 'profile-service', action: 'create-teacher-profiles', status: StepStatus.COMPLETED, idempotencyKey: 'wf:inst-3:step:2', output: { profileId: 'p1' } },
        { id: 's5', stepOrder: 3, stepName: 'init-financial-profile', targetService: 'finance-credit-service', action: 'init-teacher-financial-profile', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:3' },
        { id: 's6', stepOrder: 4, stepName: 'trigger-teacher-contract', targetService: 'legal-document-service', action: 'create-teacher-contract', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:4' },
        { id: 's7', stepOrder: 5, stepName: 'notify-rp-for-validation', targetService: 'dashboard-notification-service', action: 'notify-teacher-pending-validation', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-3:step:5' },
      ];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      // finance and legal fail but are optional; notification succeeds
      httpClient.call
        .mockResolvedValueOnce({ success: false, error: 'finance not ready' })
        .mockResolvedValueOnce({ success: false, error: 'legal not ready' })
        .mockResolvedValueOnce({ success: true, data: { notified: true } });

      await engine.executeWorkflow('inst-3');

      expect(instanceRepo.update).toHaveBeenCalledWith('inst-3', { status: WorkflowStatus.COMPLETED });
    });

    it('reuses idempotent output without calling HTTP again', async () => {
      const mockInstance = {
        id: 'inst-4',
        workflowType: 'student-onboarding',
        correlationId: 'corr-4',
        payload: { email: 'z@z.com', consents: [] },
        context: {},
        status: WorkflowStatus.IN_PROGRESS,
      };
      const mockSteps = [
        { id: 's8', stepOrder: 1, stepName: 'create-student-account', targetService: 'identity-access-service', action: 'create-account', status: StepStatus.PENDING, idempotencyKey: 'wf:inst-4:step:1' },
      ];

      instanceRepo.findOne.mockResolvedValue(mockInstance);
      stepRepo.find.mockResolvedValue(mockSteps);
      stepRepo.save.mockResolvedValue({});
      idempotency.check.mockResolvedValue({ accountId: 'cached-acc' });

      await engine.executeWorkflow('inst-4');

      expect(httpClient.call).not.toHaveBeenCalled();
      expect(instanceRepo.update).toHaveBeenCalledWith('inst-4', { status: WorkflowStatus.COMPLETED });
    });
  });
});
