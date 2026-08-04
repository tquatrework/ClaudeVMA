import { teacherOnboardingWorkflow } from '../../../src/workflow/definitions/teacher-onboarding.workflow';
import { TeacherOnboardingStartPayloadDto } from '../../../src/workflow/dto/payloads/teacher-onboarding-start-payload.dto';
import { WorkflowContext } from '../../../src/workflow/definitions/workflow-definition.interface';

const makeContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  correlationId: 'corr-test',
  payload: {
    email: 'formateur@test.com',
    password: 'P@ss1234',
    firstName: 'Marie',
    lastName: 'Martin',
    consents: ['rgpd', 'cgu'],
    subjects: ['maths'],
    levels: ['lycee'],
  },
  stepOutputs: {},
  ...overrides,
});

describe('teacherOnboardingWorkflow — ORCH-WF-TEACHER-001', () => {
  it('declares TeacherOnboardingStartPayloadDto as its start payload validation class', () => {
    expect(teacherOnboardingWorkflow.startPayloadValidationClass).toBe(TeacherOnboardingStartPayloadDto);
  });

  it('step 1 (create-teacher-account) propagates firstName and lastName to identity-access-service', () => {
    const step = teacherOnboardingWorkflow.steps[0];
    expect(step.targetService).toBe('identity-access-service');
    const payload = step.buildPayload(makeContext());
    expect(payload.firstName).toBe('Marie');
    expect(payload.lastName).toBe('Martin');
  });

  it('step 2 (create-teacher-profiles) propagates firstName and lastName to profile-service', () => {
    const step = teacherOnboardingWorkflow.steps[1];
    expect(step.targetService).toBe('profile-service');
    const context = makeContext({
      stepOutputs: { 'create-teacher-account': { accountId: 'acc-t1' } },
    });
    const payload = step.buildPayload(context);
    expect(payload.accountId).toBe('acc-t1');
    expect(payload.firstName).toBe('Marie');
    expect(payload.lastName).toBe('Martin');
  });
});
