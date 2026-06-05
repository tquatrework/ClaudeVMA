import { WorkflowDefinition } from './workflow-definition.interface';

export const teacherRequestWorkflow: WorkflowDefinition = {
  id: 'teacher-request-to-assignment',
  name: 'Demande professeur jusqu\'à affectation',
  phase: 1,
  steps: [
    {
      order: 1,
      name: 'record-teacher-request',
      targetService: 'teacher-request-service',
      action: 'create-request',
      buildPayload: (ctx) => ({
        studentId: ctx.payload.studentId,
        level: ctx.payload.level,
        subjects: ctx.payload.subjects,
        requestedBy: ctx.payload.requestedBy,
      }),
    },
    {
      order: 2,
      name: 'notify-rp',
      targetService: 'dashboard-notification-service',
      action: 'notify-new-teacher-request',
      buildPayload: (ctx) => ({
        requestId: ctx.stepOutputs['record-teacher-request']?.requestId,
        studentId: ctx.payload.studentId,
        correlationId: ctx.correlationId,
      }),
    },
    {
      order: 3,
      name: 'broadcast-to-teachers',
      targetService: 'teacher-request-service',
      action: 'broadcast-request',
      buildPayload: (ctx) => ({
        requestId: ctx.stepOutputs['record-teacher-request']?.requestId,
        teacherIds: ctx.payload.candidateTeacherIds ?? [],
      }),
    },
    {
      order: 4,
      name: 'check-calendar-availability',
      targetService: 'calendar-service',
      action: 'check-availability',
      optional: true,
      buildPayload: (ctx) => ({
        requestId: ctx.stepOutputs['record-teacher-request']?.requestId,
        desiredSlots: ctx.payload.desiredSlots ?? [],
      }),
    },
    {
      order: 5,
      name: 'create-assignment',
      targetService: 'teacher-request-service',
      action: 'create-assignment',
      buildPayload: (ctx) => ({
        requestId: ctx.stepOutputs['record-teacher-request']?.requestId,
        teacherId: ctx.payload.selectedTeacherId,
        isPrincipal: ctx.payload.isPrincipal ?? false,
      }),
    },
    {
      order: 6,
      name: 'create-teacher-student-relation',
      targetService: 'profile-service',
      action: 'create-teacher-student-relation',
      buildPayload: (ctx) => ({
        teacherId: ctx.payload.selectedTeacherId,
        studentId: ctx.payload.studentId,
        assignmentId: ctx.stepOutputs['create-assignment']?.assignmentId,
      }),
    },
    {
      order: 7,
      name: 'notify-all-parties',
      targetService: 'dashboard-notification-service',
      action: 'notify-teacher-assigned',
      buildPayload: (ctx) => ({
        teacherId: ctx.payload.selectedTeacherId,
        studentId: ctx.payload.studentId,
        assignmentId: ctx.stepOutputs['create-assignment']?.assignmentId,
        correlationId: ctx.correlationId,
      }),
    },
  ],
};
