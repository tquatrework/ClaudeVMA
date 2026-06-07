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
      buildPayload: (ctx) => ({
        email: ctx.payload.email,
        password: ctx.payload.password,
        role: 'eleve',
        consents: ctx.payload.consents,
      }),
    },
    {
      order: 2,
      name: 'create-student-profiles',
      targetService: 'profile-service',
      action: 'create-student-profiles',
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-student-account']?.accountId,
        firstName: ctx.payload.firstName,
        lastName: ctx.payload.lastName,
        birthDate: ctx.payload.birthDate,
        level: ctx.payload.level,
      }),
    },
    {
      order: 3,
      name: 'link-parent',
      targetService: 'profile-service',
      action: 'link-parent',
      optional: true,
      buildPayload: (ctx) => ({
        studentId: ctx.stepOutputs['create-student-account']?.accountId,
        financeOwnerId: ctx.payload.parentAccountId,
      }),
    },
    {
      order: 4,
      name: 'init-dashboard',
      targetService: 'dashboard-notification-service',
      action: 'init-dashboard',
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-student-account']?.accountId,
        role: 'eleve',
        correlationId: ctx.correlationId,
      }),
    },
    {
      order: 5,
      name: 'init-messaging',
      targetService: 'communication-service',
      action: 'init-messaging',
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-student-account']?.accountId,
        role: 'eleve',
        authorizedContacts: ctx.stepOutputs['link-parent']?.contacts ?? [],
      }),
    },
  ],
};
