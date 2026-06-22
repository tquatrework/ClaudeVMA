import { WorkflowDefinition } from './workflow-definition.interface';

/**
 * Saga correction/solution — functionality 005 (CDC lines 551-599).
 *
 * Déclenché lorsqu'un élève soumet une réponse et demande une correction.
 * Coordonne : correction par formateur ou activité non pourvue, attribution de points,
 * éventuelle valorisation financière, archivage.
 */
export const contentCorrectionWorkflow: WorkflowDefinition = {
  id: 'content-correction',
  name: 'Correction ou solution de contenu pédagogique',
  phase: 3,
  steps: [
    {
      order: 1,
      name: 'register-correction-request',
      targetService: 'learning-activity-service',
      action: 'create-correction-request',
      retry: { maxAttempts: 3, delayMs: 500 },
      buildPayload: (context) => ({
        studentId: context.payload.studentId,
        contentId: context.payload.contentId,
        contentType: context.payload.contentType,
        studentResponseId: context.payload.studentResponseId,
        requestedAt: context.payload.requestedAt,
      }),
      compensationAction: 'cancel-correction-request',
      buildCompensationPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
      }),
    },
    {
      order: 2,
      name: 'assign-corrector',
      targetService: 'learning-activity-service',
      action: 'assign-corrector',
      retry: { maxAttempts: 2, delayMs: 300 },
      buildPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        teacherId: context.payload.preferredTeacherId,
        deadlineHours: context.payload.deadlineHours ?? 48,
      }),
    },
    {
      order: 3,
      name: 'notify-corrector',
      targetService: 'dashboard-notification-service',
      action: 'notify-correction-assigned',
      buildPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        teacherId: context.stepOutputs['assign-corrector']?.assignedTeacherId,
        studentId: context.payload.studentId,
        deadlineHours: context.payload.deadlineHours ?? 48,
        correlationId: context.correlationId,
      }),
    },
    {
      order: 4,
      name: 'create-unprovided-activity-if-no-corrector',
      targetService: 'learning-activity-service',
      action: 'create-unprovided-activity',
      optional: true,
      buildPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        studentId: context.payload.studentId,
        contentId: context.payload.contentId,
        reason: 'no-corrector-assigned',
      }),
    },
    {
      order: 5,
      name: 'award-pedagogical-points',
      targetService: 'learning-activity-service',
      action: 'award-points',
      optional: true,
      buildPayload: (context) => ({
        studentId: context.payload.studentId,
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        pointsSource: 'correction-completed',
      }),
    },
    {
      order: 6,
      name: 'valorize-correction',
      targetService: 'finance-credit-service',
      action: 'valorize-correction',
      optional: true,
      buildPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        teacherId: context.stepOutputs['assign-corrector']?.assignedTeacherId,
        studentId: context.payload.studentId,
      }),
    },
    {
      order: 7,
      name: 'archive-correction',
      targetService: 'archive-document-service',
      action: 'archive-correction-result',
      optional: true,
      buildPayload: (context) => ({
        correctionRequestId: context.stepOutputs['register-correction-request']?.correctionRequestId,
        studentId: context.payload.studentId,
        contentId: context.payload.contentId,
        correlationId: context.correlationId,
      }),
    },
  ],
};
