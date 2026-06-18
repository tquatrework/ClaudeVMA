import { contentCorrectionWorkflow } from '../../../src/workflow/definitions/content-correction.workflow';
import { WorkflowContext } from '../../../src/workflow/definitions/workflow-definition.interface';

const makeContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  correlationId: 'corr-test',
  payload: {
    studentId: 'student-1',
    contentId: 'content-1',
    contentType: 'evaluation',
    studentResponseId: 'resp-1',
    requestedAt: '2026-06-18T10:00:00Z',
    preferredTeacherId: 'teacher-1',
    deadlineHours: 48,
  },
  stepOutputs: {
    'register-correction-request': { correctionRequestId: 'corr-req-1' },
    'assign-corrector': { assignedTeacherId: 'teacher-1' },
  },
  ...overrides,
});

describe('contentCorrectionWorkflow — ORCH-WF-CONTENT-001', () => {
  it('has correct id, name and phase', () => {
    expect(contentCorrectionWorkflow.id).toBe('content-correction');
    expect(contentCorrectionWorkflow.name).toBe('Correction ou solution de contenu pédagogique');
    expect(contentCorrectionWorkflow.phase).toBe(3);
  });

  it('has 7 steps in the correct order', () => {
    expect(contentCorrectionWorkflow.steps).toHaveLength(7);
    const stepOrders = contentCorrectionWorkflow.steps.map((step) => step.order);
    expect(stepOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('step 1 targets learning-activity-service with create-correction-request', () => {
    const step = contentCorrectionWorkflow.steps[0];
    expect(step.targetService).toBe('learning-activity-service');
    expect(step.action).toBe('create-correction-request');
    expect(step.optional).toBeFalsy();
    expect(step.retry?.maxAttempts).toBe(3);
  });

  it('step 1 buildPayload maps student and content fields', () => {
    const context = makeContext();
    const payload = contentCorrectionWorkflow.steps[0].buildPayload(context);
    expect(payload.studentId).toBe('student-1');
    expect(payload.contentId).toBe('content-1');
    expect(payload.contentType).toBe('evaluation');
    expect(payload.studentResponseId).toBe('resp-1');
  });

  it('step 1 has compensation action cancel-correction-request', () => {
    const step = contentCorrectionWorkflow.steps[0];
    expect(step.compensationAction).toBe('cancel-correction-request');
    const context = makeContext();
    const compensationPayload = step.buildCompensationPayload!(context);
    expect(compensationPayload.correctionRequestId).toBe('corr-req-1');
  });

  it('step 2 targets learning-activity-service with assign-corrector', () => {
    const step = contentCorrectionWorkflow.steps[1];
    expect(step.targetService).toBe('learning-activity-service');
    expect(step.action).toBe('assign-corrector');
    expect(step.optional).toBeFalsy();
  });

  it('step 2 buildPayload includes correctionRequestId from step 1 output', () => {
    const context = makeContext();
    const payload = contentCorrectionWorkflow.steps[1].buildPayload(context);
    expect(payload.correctionRequestId).toBe('corr-req-1');
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.deadlineHours).toBe(48);
  });

  it('step 2 defaults deadlineHours to 48 when not provided', () => {
    const context = makeContext({
      payload: {
        studentId: 'student-2',
        contentId: 'content-2',
        contentType: 'exercice',
        studentResponseId: 'resp-2',
      },
    });
    const payload = contentCorrectionWorkflow.steps[1].buildPayload(context);
    expect(payload.deadlineHours).toBe(48);
  });

  it('step 3 targets dashboard-notification-service for notify-correction-assigned', () => {
    const step = contentCorrectionWorkflow.steps[2];
    expect(step.targetService).toBe('dashboard-notification-service');
    expect(step.action).toBe('notify-correction-assigned');
    expect(step.optional).toBeFalsy();
  });

  it('step 3 buildPayload propagates correctionRequestId and assignedTeacherId', () => {
    const context = makeContext();
    const payload = contentCorrectionWorkflow.steps[2].buildPayload(context);
    expect(payload.correctionRequestId).toBe('corr-req-1');
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.correlationId).toBe('corr-test');
  });

  it('steps 4, 5, 6, 7 are all optional', () => {
    const optionalSteps = contentCorrectionWorkflow.steps.slice(3);
    optionalSteps.forEach((step) => {
      expect(step.optional).toBe(true);
    });
  });

  it('step 4 creates unprovided activity via learning-activity-service', () => {
    const step = contentCorrectionWorkflow.steps[3];
    expect(step.targetService).toBe('learning-activity-service');
    expect(step.action).toBe('create-unprovided-activity');
  });

  it('step 5 awards pedagogical points via learning-activity-service', () => {
    const step = contentCorrectionWorkflow.steps[4];
    expect(step.targetService).toBe('learning-activity-service');
    expect(step.action).toBe('award-points');
  });

  it('step 6 valorizes correction via finance-credit-service', () => {
    const step = contentCorrectionWorkflow.steps[5];
    expect(step.targetService).toBe('finance-credit-service');
    expect(step.action).toBe('valorize-correction');
  });

  it('step 7 archives correction via archive-document-service', () => {
    const step = contentCorrectionWorkflow.steps[6];
    expect(step.targetService).toBe('archive-document-service');
    expect(step.action).toBe('archive-correction-result');
  });

  it('step 7 buildPayload includes contentId and correlationId', () => {
    const context = makeContext();
    const payload = contentCorrectionWorkflow.steps[6].buildPayload(context);
    expect(payload.correctionRequestId).toBe('corr-req-1');
    expect(payload.contentId).toBe('content-1');
    expect(payload.correlationId).toBe('corr-test');
  });
});
