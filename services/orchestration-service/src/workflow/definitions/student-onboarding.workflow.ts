import { WorkflowDefinition } from './workflow-definition.interface';

export const studentOnboardingWorkflow: WorkflowDefinition = {
  id: 'student-onboarding',
  name: 'Inscription et activation élève',
  phase: 1,
  steps: [
    {
      order: 1,
      name: 'create-student-account',
      targetService: 'identity-access-service',
      action: 'create-account',
      retry: { maxAttempts: 3, delayMs: 500 },
      buildPayload: (context) => ({
        email: context.payload.email,
        password: context.payload.password,
        role: 'eleve',
        consents: context.payload.consents,
      }),
      compensationAction: 'delete-account',
      buildCompensationPayload: (context) => ({
        accountId: context.stepOutputs['create-student-account']?.accountId,
      }),
    },
    {
      order: 2,
      name: 'create-student-profiles',
      targetService: 'profile-service',
      action: 'create-student-profiles',
      retry: { maxAttempts: 2, delayMs: 300 },
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-student-account']?.accountId,
        firstName: context.payload.firstName,
        lastName: context.payload.lastName,
        birthDate: context.payload.birthDate,
        level: context.payload.level,
      }),
      compensationAction: 'delete-profiles',
      buildCompensationPayload: (context) => ({
        accountId: context.stepOutputs['create-student-account']?.accountId,
      }),
    },
    {
      order: 3,
      name: 'link-parent',
      targetService: 'profile-service',
      action: 'link-parent',
      optional: true,
      buildPayload: (context) => ({
        studentId: context.stepOutputs['create-student-account']?.accountId,
        financeOwnerId: context.payload.parentAccountId,
      }),
    },
    {
      order: 4,
      name: 'init-dashboard',
      targetService: 'dashboard-notification-service',
      action: 'init-dashboard',
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-student-account']?.accountId,
        role: 'eleve',
        correlationId: context.correlationId,
      }),
    },
    {
      order: 5,
      name: 'init-messaging',
      targetService: 'communication-service',
      action: 'init-messaging',
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-student-account']?.accountId,
        role: 'eleve',
        authorizedContacts: context.stepOutputs['link-parent']?.contacts ?? [],
      }),
    },
  ],
};
