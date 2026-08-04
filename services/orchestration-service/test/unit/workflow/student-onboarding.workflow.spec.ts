import { studentOnboardingWorkflow } from '../../../src/workflow/definitions/student-onboarding.workflow';
import { StudentOnboardingStartPayloadDto } from '../../../src/workflow/dto/payloads/student-onboarding-start-payload.dto';
import { WorkflowContext } from '../../../src/workflow/definitions/workflow-definition.interface';

const makeContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  correlationId: 'corr-test',
  payload: {
    email: 'eleve@test.com',
    password: 'P@ss1234',
    firstName: 'Jean',
    lastName: 'Dupont',
    consents: ['rgpd', 'cgu'],
  },
  stepOutputs: {},
  ...overrides,
});

describe('studentOnboardingWorkflow — ORCH-WF-STUDENT-001', () => {
  it('declares StudentOnboardingStartPayloadDto as its start payload validation class', () => {
    expect(studentOnboardingWorkflow.startPayloadValidationClass).toBe(StudentOnboardingStartPayloadDto);
  });

  it('step 1 (create-student-account) propagates firstName and lastName to identity-access-service', () => {
    const step = studentOnboardingWorkflow.steps[0];
    expect(step.targetService).toBe('identity-access-service');
    const payload = step.buildPayload(makeContext());
    expect(payload.firstName).toBe('Jean');
    expect(payload.lastName).toBe('Dupont');
  });

  it('step 1 never includes parent fields — parentAccountId only links an existing parent, it is not created here', () => {
    const step = studentOnboardingWorkflow.steps[0];
    const context = makeContext({
      payload: { ...makeContext().payload, parentAccountId: 'parent-1' },
    });
    const payload = step.buildPayload(context);
    expect(payload).not.toHaveProperty('parentFirstName');
    expect(payload).not.toHaveProperty('parentLastName');
  });

  it('step 2 (create-student-profiles) propagates firstName and lastName to profile-service', () => {
    const step = studentOnboardingWorkflow.steps[1];
    expect(step.targetService).toBe('profile-service');
    const context = makeContext({
      stepOutputs: { 'create-student-account': { accountId: 'acc-1' } },
    });
    const payload = step.buildPayload(context);
    expect(payload.accountId).toBe('acc-1');
    expect(payload.firstName).toBe('Jean');
    expect(payload.lastName).toBe('Dupont');
  });

  it('step 3 (link-parent) only sends studentId/financeOwnerId — it links an existing parent by id, no name needed', () => {
    const step = studentOnboardingWorkflow.steps[2];
    expect(step.targetService).toBe('profile-service');
    expect(step.optional).toBe(true);
    const context = makeContext({
      payload: { ...makeContext().payload, parentAccountId: 'parent-1' },
      stepOutputs: { 'create-student-account': { accountId: 'acc-1' } },
    });
    const payload = step.buildPayload(context);
    expect(payload.studentId).toBe('acc-1');
    expect(payload.financeOwnerId).toBe('parent-1');
    expect(payload).not.toHaveProperty('parentFirstName');
    expect(payload).not.toHaveProperty('parentLastName');
  });
});
