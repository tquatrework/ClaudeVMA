import { WorkflowDefinition } from './workflow-definition.interface';

export const videoSessionWorkflow: WorkflowDefinition = {
  id: 'scheduled-video-course',
  name: 'Planification et exécution d\'une visio',
  phase: 1,
  steps: [
    {
      order: 1,
      name: 'schedule-activity',
      targetService: 'calendar-service',
      action: 'schedule-activity',
      buildPayload: (ctx) => ({
        teacherId: ctx.payload.teacherId,
        studentId: ctx.payload.studentId,
        startAt: ctx.payload.startAt,
        durationMinutes: ctx.payload.durationMinutes,
        subject: ctx.payload.subject,
      }),
    },
    {
      order: 2,
      name: 'create-video-room',
      targetService: 'video-session-service',
      action: 'create-session',
      buildPayload: (ctx) => ({
        activityId: ctx.stepOutputs['schedule-activity']?.activityId,
        teacherId: ctx.payload.teacherId,
        participantIds: [ctx.payload.teacherId, ctx.payload.studentId],
        startAt: ctx.payload.startAt,
        durationMinutes: ctx.payload.durationMinutes,
      }),
    },
    {
      order: 3,
      name: 'notify-participants',
      targetService: 'dashboard-notification-service',
      action: 'notify-session-scheduled',
      buildPayload: (ctx) => ({
        sessionId: ctx.stepOutputs['create-video-room']?.sessionId,
        activityId: ctx.stepOutputs['schedule-activity']?.activityId,
        participantIds: [ctx.payload.teacherId, ctx.payload.studentId],
        startAt: ctx.payload.startAt,
        joinUrl: ctx.stepOutputs['create-video-room']?.joinUrl,
        correlationId: ctx.correlationId,
      }),
    },
    {
      order: 4,
      name: 'trace-session-end',
      targetService: 'video-session-service',
      action: 'register-end-hook',
      buildPayload: (ctx) => ({
        sessionId: ctx.stepOutputs['create-video-room']?.sessionId,
        callbackUrl: ctx.payload.sessionEndCallbackUrl,
      }),
    },
    {
      order: 5,
      name: 'prompt-pedagogical-log',
      targetService: 'pedagogical-log-service',
      action: 'create-log-entry-placeholder',
      buildPayload: (ctx) => ({
        sessionId: ctx.stepOutputs['create-video-room']?.sessionId,
        teacherId: ctx.payload.teacherId,
        studentId: ctx.payload.studentId,
        scheduledAt: ctx.payload.startAt,
      }),
    },
    {
      order: 6,
      name: 'debit-credits',
      targetService: 'finance-credit-service',
      action: 'reserve-credits',
      optional: true,
      buildPayload: (ctx) => ({
        sessionId: ctx.stepOutputs['create-video-room']?.sessionId,
        studentId: ctx.payload.studentId,
        teacherId: ctx.payload.teacherId,
        durationMinutes: ctx.payload.durationMinutes,
      }),
    },
  ],
};
