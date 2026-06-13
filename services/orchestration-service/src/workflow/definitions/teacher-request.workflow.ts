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
      buildPayload: (context) => ({
        studentId: context.payload.studentId,
        level: context.payload.level,
        subjects: context.payload.subjects,
        requestedBy: context.payload.requestedBy,
      }),
    },
    {
      order: 2,
      name: 'notify-rp',
      targetService: 'dashboard-notification-service',
      action: 'notify-new-teacher-request',
      buildPayload: (context) => ({
        requestId: context.stepOutputs['record-teacher-request']?.requestId,
        studentId: context.payload.studentId,
        correlationId: context.correlationId,
      }),
    },
    {
      order: 3,
      name: 'broadcast-to-teachers',
      targetService: 'teacher-request-service',
      action: 'broadcast-request',
      buildPayload: (context) => ({
        requestId: context.stepOutputs['record-teacher-request']?.requestId,
        teacherIds: context.payload.candidateTeacherIds ?? [],
      }),
    },
    {
      order: 4,
      name: 'check-calendar-availability',
      targetService: 'calendar-service',
      action: 'check-availability',
      optional: true,
      buildPayload: (context) => ({
        requestId: context.stepOutputs['record-teacher-request']?.requestId,
        desiredSlots: context.payload.desiredSlots ?? [],
      }),
    },
    {
      order: 5,
      name: 'create-assignment',
      targetService: 'teacher-request-service',
      action: 'create-assignment',
      buildPayload: (context) => ({
        requestId: context.stepOutputs['record-teacher-request']?.requestId,
        teacherId: context.payload.selectedTeacherId,
        isPrincipal: context.payload.isPrincipal ?? false,
      }),
    },
    {
      order: 6,
      name: 'create-teacher-student-relation',
      targetService: 'profile-service',
      action: 'create-teacher-student-relation',
      buildPayload: (context) => ({
        teacherId: context.payload.selectedTeacherId,
        studentId: context.payload.studentId,
        assignmentId: context.stepOutputs['create-assignment']?.assignmentId,
      }),
    },
    {
      order: 7,
      name: 'notify-all-parties',
      targetService: 'dashboard-notification-service',
      action: 'notify-teacher-assigned',
      buildPayload: (context) => ({
        teacherId: context.payload.selectedTeacherId,
        studentId: context.payload.studentId,
        assignmentId: context.stepOutputs['create-assignment']?.assignmentId,
        correlationId: context.correlationId,
      }),
    },
  ],
};
