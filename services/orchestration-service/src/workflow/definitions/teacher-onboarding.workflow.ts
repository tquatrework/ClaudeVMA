import { WorkflowDefinition } from './workflow-definition.interface';
import { TeacherOnboardingStartPayloadDto } from '../dto/payloads/teacher-onboarding-start-payload.dto';

export const teacherOnboardingWorkflow: WorkflowDefinition = {
  id: 'teacher-onboarding',
  name: 'Inscription et validation formateur',
  phase: 1,
  startPayloadValidationClass: TeacherOnboardingStartPayloadDto,
  steps: [
    {
      order: 1,
      name: 'create-teacher-account',
      targetService: 'identity-access-service',
      action: 'create-account',
      buildPayload: (context) => ({
        email: context.payload.email,
        password: context.payload.password,
        role: 'formateur',
        consents: context.payload.consents,
      }),
    },
    {
      order: 2,
      name: 'create-teacher-profiles',
      targetService: 'profile-service',
      action: 'create-teacher-profiles',
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-teacher-account']?.accountId,
        firstName: context.payload.firstName,
        lastName: context.payload.lastName,
        subjects: context.payload.subjects,
        levels: context.payload.levels,
        bio: context.payload.bio,
      }),
    },
    {
      order: 3,
      name: 'init-financial-profile',
      targetService: 'finance-credit-service',
      action: 'init-teacher-financial-profile',
      optional: true,
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-teacher-account']?.accountId,
        bankDetails: context.payload.bankDetails,
      }),
    },
    {
      order: 4,
      name: 'trigger-teacher-contract',
      targetService: 'legal-document-service',
      action: 'create-teacher-contract',
      optional: true,
      buildPayload: (context) => ({
        accountId: context.stepOutputs['create-teacher-account']?.accountId,
        profileId: context.stepOutputs['create-teacher-profiles']?.profileId,
      }),
    },
    {
      order: 5,
      name: 'notify-rp-for-validation',
      targetService: 'dashboard-notification-service',
      action: 'notify-teacher-pending-validation',
      buildPayload: (context) => ({
        teacherAccountId: context.stepOutputs['create-teacher-account']?.accountId,
        correlationId: context.correlationId,
      }),
    },
  ],
};
