import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowController } from '../../../src/workflow/workflow.controller';
import { WorkflowEngineService } from '../../../src/workflow/workflow-engine.service';
import { WORKFLOW_DEFINITIONS } from '../../../src/workflow/definitions';
import { WorkflowStatus } from '../../../src/common/enums/workflow-status.enum';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';

const makeEngineMock = () => ({
  startWorkflow: jest.fn(),
  getInstance: jest.fn(),
  suspendForArbitration: jest.fn().mockResolvedValue(undefined),
  resumeAfterArbitration: jest.fn().mockResolvedValue(undefined),
});

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let engine: ReturnType<typeof makeEngineMock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [{ provide: WorkflowEngineService, useFactory: makeEngineMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(WorkflowController);
    engine = module.get(WorkflowEngineService);
  });

  describe('start — ORCH-WF-001', () => {
    it('starts a known workflow and returns instance metadata', async () => {
      const mockInstance = {
        id: 'inst-1',
        workflowType: 'student-onboarding',
        correlationId: 'corr-1',
        status: WorkflowStatus.IN_PROGRESS,
        createdAt: new Date(),
      };
      engine.startWorkflow.mockResolvedValue(mockInstance);

      const result = await controller.start(
        'student-onboarding',
        { workflowType: 'student-onboarding', payload: { email: 'a@b.com' } },
        { user: { id: 'user-1' } },
      );

      expect(result.workflowInstanceId).toBe('inst-1');
      expect(result.workflowType).toBe('student-onboarding');
      expect(result.correlationId).toBe('corr-1');
      expect(result.status).toBe(WorkflowStatus.IN_PROGRESS);
    });

    it('throws NotFoundException for an unknown workflow type — ORCH-WF-002', async () => {
      await expect(
        controller.start('unknown-workflow', { workflowType: 'unknown-workflow', payload: {} }, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses initiatedBy from JWT user when not in body — ORCH-WF-003', async () => {
      engine.startWorkflow.mockResolvedValue({
        id: 'inst-2',
        workflowType: 'student-onboarding',
        correlationId: 'corr-2',
        status: WorkflowStatus.IN_PROGRESS,
        createdAt: new Date(),
      });

      await controller.start(
        'student-onboarding',
        { workflowType: 'student-onboarding', payload: {} },
        { user: { id: 'user-jwt' } },
      );

      expect(engine.startWorkflow).toHaveBeenCalledWith(
        'student-onboarding',
        {},
        'user-jwt',
        undefined,
      );
    });
  });

  describe('getOne — ORCH-WF-004', () => {
    it('returns instance with steps when found', async () => {
      const mockData = {
        id: 'inst-3',
        workflowType: 'teacher-onboarding',
        steps: [{ id: 's1' }, { id: 's2' }],
      };
      engine.getInstance.mockResolvedValue(mockData);

      const result = await controller.getOne('inst-3');

      expect(result).toEqual(mockData);
      expect(engine.getInstance).toHaveBeenCalledWith('inst-3');
    });

    it('throws NotFoundException when instance does not exist — ORCH-WF-005', async () => {
      engine.getInstance.mockResolvedValue(null);

      await expect(controller.getOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suspend — ORCH-WF-006', () => {
    it('suspends a workflow and returns status needs_arbitration', async () => {
      const result = await controller.suspend(
        'inst-4',
        { reason: 'accord utilisateur requis' },
        { user: { id: 'rp-1' } },
      );

      expect(engine.suspendForArbitration).toHaveBeenCalledWith(
        'inst-4',
        'accord utilisateur requis',
        'rp-1',
      );
      expect(result).toEqual({
        workflowInstanceId: 'inst-4',
        status: 'needs_arbitration',
        reason: 'accord utilisateur requis',
      });
    });
  });

  describe('resume — ORCH-WF-007', () => {
    it('resumes a workflow with tiOverride flag', async () => {
      const result = await controller.resume(
        'inst-5',
        { tiOverride: true },
        { user: { id: 'ti-1' } },
      );

      expect(engine.resumeAfterArbitration).toHaveBeenCalledWith('inst-5', 'ti-1', true);
      expect(result).toEqual({
        workflowInstanceId: 'inst-5',
        status: 'in_progress',
        tiOverride: true,
      });
    });

    it('resumes without tiOverride by default — ORCH-WF-008', async () => {
      const result = await controller.resume('inst-6', {}, { user: { id: 'rp-2' } });

      expect(engine.resumeAfterArbitration).toHaveBeenCalledWith('inst-6', 'rp-2', false);
      expect(result.tiOverride).toBe(false);
    });
  });

  describe('listDefinitions — ORCH-WF-009', () => {
    it('returns a summary of all available workflow definitions', () => {
      const result = controller.listDefinitions();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(Object.keys(WORKFLOW_DEFINITIONS).length);
      result.forEach((d) => {
        expect(d).toHaveProperty('id');
        expect(d).toHaveProperty('name');
        expect(d).toHaveProperty('phase');
        expect(d).toHaveProperty('stepCount');
      });
    });

    it('includes all four phase-1 workflows — ORCH-WF-010', () => {
      const result = controller.listDefinitions();
      const ids = result.map((d) => d.id);

      expect(ids).toContain('student-onboarding');
      expect(ids).toContain('teacher-onboarding');
      expect(ids).toContain('teacher-request-to-assignment');
      expect(ids).toContain('scheduled-video-course');
    });

    it('includes phase-2 and phase-3 workflows — ORCH-WF-011', () => {
      const result = controller.listDefinitions();
      const ids = result.map((d) => d.id);

      expect(ids).toContain('teacher-payment');
      expect(ids).toContain('content-correction');
    });

    it('lists 6 workflows in total — ORCH-WF-012', () => {
      const result = controller.listDefinitions();
      expect(result).toHaveLength(6);
    });
  });
});
