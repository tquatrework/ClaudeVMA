import { WorkflowDefinition } from './workflow-definition.interface';

export const teacherOnboardingWorkflow: WorkflowDefinition = {
  id: 'teacher-onboarding',
  name: 'Inscription et validation formateur',
  phase: 1,
  steps: [
    {
      order: 1,
      name: 'create-teacher-account',
      targetService: 'identity-access-service',
      action: 'create-account',
      buildPayload: (ctx) => ({
        email: ctx.payload.email,
        password: ctx.payload.password,
        role: 'formateur',
        consents: ctx.payload.consents,
      }),
    },
    {
      order: 2,
      name: 'create-teacher-profiles',
      targetService: 'profile-service',
      action: 'create-teacher-profiles',
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-teacher-account']?.accountId,
        firstName: ctx.payload.firstName,
        lastName: ctx.payload.lastName,
        subjects: ctx.payload.subjects,
        levels: ctx.payload.levels,
        bio: ctx.payload.bio,
      }),
    },
    {
      order: 3,
      name: 'init-financial-profile',
      targetService: 'finance-credit-service',
      action: 'init-teacher-financial-profile',
      optional: true,
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-teacher-account']?.accountId,
        bankDetails: ctx.payload.bankDetails,
      }),
    },
    {
      order: 4,
      name: 'trigger-teacher-contract',
      targetService: 'legal-document-service',
      action: 'create-teacher-contract',
      optional: true,
      buildPayload: (ctx) => ({
        accountId: ctx.stepOutputs['create-teacher-account']?.accountId,
        profileId: ctx.stepOutputs['create-teacher-profiles']?.profileId,
      }),
    },
    {
      order: 5,
      name: 'notify-rp-for-validation',
      targetService: 'dashboard-notification-service',
      action: 'notify-teacher-pending-validation',
      buildPayload: (ctx) => ({
        teacherAccountId: ctx.stepOutputs['create-teacher-account']?.accountId,
        correlationId: ctx.correlationId,
      }),
    },
  ],
};
