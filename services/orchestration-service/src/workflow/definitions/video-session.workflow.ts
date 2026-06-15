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
      buildPayload: (context) => ({
        teacherId: context.payload.teacherId,
        studentId: context.payload.studentId,
        startAt: context.payload.startAt,
        durationMinutes: context.payload.durationMinutes,
        subject: context.payload.subject,
      }),
    },
    {
      order: 2,
      name: 'create-video-room',
      targetService: 'video-session-service',
      action: 'create-session',
      buildPayload: (context) => ({
        activityId: context.stepOutputs['schedule-activity']?.activityId,
        teacherId: context.payload.teacherId,
        participantIds: [context.payload.teacherId, context.payload.studentId],
        startAt: context.payload.startAt,
        durationMinutes: context.payload.durationMinutes,
      }),
    },
    {
      order: 3,
      name: 'notify-participants',
      targetService: 'dashboard-notification-service',
      action: 'notify-session-scheduled',
      buildPayload: (context) => ({
        sessionId: context.stepOutputs['create-video-room']?.sessionId,
        activityId: context.stepOutputs['schedule-activity']?.activityId,
        participantIds: [context.payload.teacherId, context.payload.studentId],
        startAt: context.payload.startAt,
        joinUrl: context.stepOutputs['create-video-room']?.joinUrl,
        correlationId: context.correlationId,
      }),
    },
    {
      order: 4,
      name: 'trace-session-end',
      targetService: 'video-session-service',
      action: 'register-end-hook',
      buildPayload: (context) => ({
        sessionId: context.stepOutputs['create-video-room']?.sessionId,
        callbackUrl: context.payload.sessionEndCallbackUrl,
      }),
    },
    {
      order: 5,
      name: 'prompt-pedagogical-log',
      targetService: 'pedagogical-log-service',
      action: 'create-log-entry-placeholder',
      buildPayload: (context) => ({
        sessionId: context.stepOutputs['create-video-room']?.sessionId,
        teacherId: context.payload.teacherId,
        studentId: context.payload.studentId,
        scheduledAt: context.payload.startAt,
      }),
    },
    {
      order: 6,
      name: 'debit-credits',
      targetService: 'finance-credit-service',
      action: 'reserve-credits',
      optional: true,
      buildPayload: (context) => ({
        sessionId: context.stepOutputs['create-video-room']?.sessionId,
        studentId: context.payload.studentId,
        teacherId: context.payload.teacherId,
        durationMinutes: context.payload.durationMinutes,
      }),
    },
  ],
};
