import { teacherPaymentWorkflow } from '../../../src/workflow/definitions/teacher-payment.workflow';
import { WorkflowContext } from '../../../src/workflow/definitions/workflow-definition.interface';

const makeContext = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  correlationId: 'corr-pay-1',
  payload: {
    teacherId: 'teacher-1',
    financeOwnerId: 'finance-owner-1',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    sessionIds: ['sess-1', 'sess-2'],
  },
  stepOutputs: {
    'generate-teacher-invoice': { invoiceId: 'inv-1', amount: 150 },
    'debit-finance-owner': { success: true },
  },
  ...overrides,
});

describe('teacherPaymentWorkflow — ORCH-WF-PAY-001', () => {
  it('has correct id, name and phase', () => {
    expect(teacherPaymentWorkflow.id).toBe('teacher-payment');
    expect(teacherPaymentWorkflow.name).toBe('Paiement et rémunération formateur');
    expect(teacherPaymentWorkflow.phase).toBe(2);
  });

  it('has 6 steps in the correct order', () => {
    expect(teacherPaymentWorkflow.steps).toHaveLength(6);
    const stepOrders = teacherPaymentWorkflow.steps.map((step) => step.order);
    expect(stepOrders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('step 1 targets finance-credit-service with generate-teacher-invoice', () => {
    const step = teacherPaymentWorkflow.steps[0];
    expect(step.targetService).toBe('finance-credit-service');
    expect(step.action).toBe('generate-teacher-invoice');
    expect(step.optional).toBeFalsy();
    expect(step.retry?.maxAttempts).toBe(3);
  });

  it('step 1 buildPayload includes teacherId and session data', () => {
    const context = makeContext();
    const payload = teacherPaymentWorkflow.steps[0].buildPayload(context);
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.periodStart).toBe('2026-06-01');
    expect(payload.periodEnd).toBe('2026-06-30');
    expect(payload.sessionIds).toEqual(['sess-1', 'sess-2']);
  });

  it('step 1 defaults sessionIds to [] when not provided', () => {
    const context = makeContext({
      payload: { teacherId: 'teacher-2', financeOwnerId: 'fo-2', periodStart: '2026-06-01', periodEnd: '2026-06-30' },
    });
    const payload = teacherPaymentWorkflow.steps[0].buildPayload(context);
    expect(payload.sessionIds).toEqual([]);
  });

  it('step 1 has compensation action cancel-teacher-invoice', () => {
    const step = teacherPaymentWorkflow.steps[0];
    expect(step.compensationAction).toBe('cancel-teacher-invoice');
    const context = makeContext();
    const compensationPayload = step.buildCompensationPayload!(context);
    expect(compensationPayload.invoiceId).toBe('inv-1');
  });

  it('step 2 targets dashboard-notification-service for notify-invoice-pending-validation', () => {
    const step = teacherPaymentWorkflow.steps[1];
    expect(step.targetService).toBe('dashboard-notification-service');
    expect(step.action).toBe('notify-invoice-pending-validation');
    expect(step.optional).toBeFalsy();
  });

  it('step 2 buildPayload propagates invoiceId and amount from step 1', () => {
    const context = makeContext();
    const payload = teacherPaymentWorkflow.steps[1].buildPayload(context);
    expect(payload.invoiceId).toBe('inv-1');
    expect(payload.amount).toBe(150);
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.correlationId).toBe('corr-pay-1');
  });

  it('step 3 debits finance-owner credits via finance-credit-service', () => {
    const step = teacherPaymentWorkflow.steps[2];
    expect(step.targetService).toBe('finance-credit-service');
    expect(step.action).toBe('debit-finance-owner-credits');
    expect(step.optional).toBeFalsy();
    expect(step.retry?.maxAttempts).toBe(2);
  });

  it('step 3 buildPayload includes financeOwnerId and amount', () => {
    const context = makeContext();
    const payload = teacherPaymentWorkflow.steps[2].buildPayload(context);
    expect(payload.financeOwnerId).toBe('finance-owner-1');
    expect(payload.amount).toBe(150);
    expect(payload.invoiceId).toBe('inv-1');
  });

  it('step 3 has compensation refund-finance-owner', () => {
    const step = teacherPaymentWorkflow.steps[2];
    expect(step.compensationAction).toBe('refund-finance-owner');
    const context = makeContext();
    const compensationPayload = step.buildCompensationPayload!(context);
    expect(compensationPayload.financeOwnerId).toBe('finance-owner-1');
    expect(compensationPayload.invoiceId).toBe('inv-1');
  });

  it('step 4 credits teacher remuneration via finance-credit-service', () => {
    const step = teacherPaymentWorkflow.steps[3];
    expect(step.targetService).toBe('finance-credit-service');
    expect(step.action).toBe('credit-teacher-remuneration');
    expect(step.optional).toBeFalsy();
    expect(step.retry?.maxAttempts).toBe(2);
  });

  it('step 4 has compensation cancel-teacher-remuneration', () => {
    const step = teacherPaymentWorkflow.steps[3];
    expect(step.compensationAction).toBe('cancel-teacher-remuneration');
    const context = makeContext();
    const compensationPayload = step.buildCompensationPayload!(context);
    expect(compensationPayload.teacherId).toBe('teacher-1');
    expect(compensationPayload.invoiceId).toBe('inv-1');
  });

  it('step 5 is optional and archives via archive-document-service', () => {
    const step = teacherPaymentWorkflow.steps[4];
    expect(step.optional).toBe(true);
    expect(step.targetService).toBe('archive-document-service');
    expect(step.action).toBe('archive-payment-documents');
  });

  it('step 5 buildPayload includes invoiceId and correlationId', () => {
    const context = makeContext();
    const payload = teacherPaymentWorkflow.steps[4].buildPayload(context);
    expect(payload.invoiceId).toBe('inv-1');
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.correlationId).toBe('corr-pay-1');
  });

  it('step 6 notifies teacher via dashboard-notification-service', () => {
    const step = teacherPaymentWorkflow.steps[5];
    expect(step.targetService).toBe('dashboard-notification-service');
    expect(step.action).toBe('notify-teacher-payment-done');
    expect(step.optional).toBeFalsy();
  });

  it('step 6 buildPayload includes amount from invoice step', () => {
    const context = makeContext();
    const payload = teacherPaymentWorkflow.steps[5].buildPayload(context);
    expect(payload.teacherId).toBe('teacher-1');
    expect(payload.invoiceId).toBe('inv-1');
    expect(payload.amount).toBe(150);
    expect(payload.correlationId).toBe('corr-pay-1');
  });
});
