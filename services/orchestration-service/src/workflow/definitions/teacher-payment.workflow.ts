import { WorkflowDefinition } from './workflow-definition.interface';

/**
 * Saga paiement formateur — functionality 006 (CDC lines 600-626).
 *
 * Coordonne : émission facture, validation AF, débit points financeur, archivage.
 */
export const teacherPaymentWorkflow: WorkflowDefinition = {
  id: 'teacher-payment',
  name: 'Paiement et rémunération formateur',
  phase: 2,
  steps: [
    {
      order: 1,
      name: 'generate-teacher-invoice',
      targetService: 'finance-credit-service',
      action: 'generate-teacher-invoice',
      retry: { maxAttempts: 3, delayMs: 500 },
      buildPayload: (context) => ({
        teacherId: context.payload.teacherId,
        periodStart: context.payload.periodStart,
        periodEnd: context.payload.periodEnd,
        sessionIds: context.payload.sessionIds ?? [],
      }),
      compensationAction: 'cancel-teacher-invoice',
      buildCompensationPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
      }),
    },
    {
      order: 2,
      name: 'notify-af-for-validation',
      targetService: 'dashboard-notification-service',
      action: 'notify-invoice-pending-validation',
      buildPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        teacherId: context.payload.teacherId,
        amount: context.stepOutputs['generate-teacher-invoice']?.amount,
        correlationId: context.correlationId,
      }),
    },
    {
      order: 3,
      name: 'debit-finance-owner',
      targetService: 'finance-credit-service',
      action: 'debit-finance-owner-credits',
      retry: { maxAttempts: 2, delayMs: 300 },
      buildPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        financeOwnerId: context.payload.financeOwnerId,
        amount: context.stepOutputs['generate-teacher-invoice']?.amount,
      }),
      compensationAction: 'refund-finance-owner',
      buildCompensationPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        financeOwnerId: context.payload.financeOwnerId,
      }),
    },
    {
      order: 4,
      name: 'credit-teacher-remuneration',
      targetService: 'finance-credit-service',
      action: 'credit-teacher-remuneration',
      retry: { maxAttempts: 2, delayMs: 300 },
      buildPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        teacherId: context.payload.teacherId,
        amount: context.stepOutputs['generate-teacher-invoice']?.amount,
      }),
      compensationAction: 'cancel-teacher-remuneration',
      buildCompensationPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        teacherId: context.payload.teacherId,
      }),
    },
    {
      order: 5,
      name: 'archive-payment',
      targetService: 'archive-document-service',
      action: 'archive-payment-documents',
      optional: true,
      buildPayload: (context) => ({
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        teacherId: context.payload.teacherId,
        correlationId: context.correlationId,
      }),
    },
    {
      order: 6,
      name: 'notify-teacher-payment-done',
      targetService: 'dashboard-notification-service',
      action: 'notify-teacher-payment-done',
      buildPayload: (context) => ({
        teacherId: context.payload.teacherId,
        invoiceId: context.stepOutputs['generate-teacher-invoice']?.invoiceId,
        amount: context.stepOutputs['generate-teacher-invoice']?.amount,
        correlationId: context.correlationId,
      }),
    },
  ],
};
