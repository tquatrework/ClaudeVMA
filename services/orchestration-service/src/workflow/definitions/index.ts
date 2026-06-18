import { WorkflowDefinition } from './workflow-definition.interface';
import { studentOnboardingWorkflow } from './student-onboarding.workflow';
import { teacherOnboardingWorkflow } from './teacher-onboarding.workflow';
import { teacherRequestWorkflow } from './teacher-request.workflow';
import { videoSessionWorkflow } from './video-session.workflow';
import { contentCorrectionWorkflow } from './content-correction.workflow';
import { teacherPaymentWorkflow } from './teacher-payment.workflow';

export const WORKFLOW_DEFINITIONS: Record<string, WorkflowDefinition> = {
  [studentOnboardingWorkflow.id]: studentOnboardingWorkflow,
  [teacherOnboardingWorkflow.id]: teacherOnboardingWorkflow,
  [teacherRequestWorkflow.id]: teacherRequestWorkflow,
  [videoSessionWorkflow.id]: videoSessionWorkflow,
  [contentCorrectionWorkflow.id]: contentCorrectionWorkflow,
  [teacherPaymentWorkflow.id]: teacherPaymentWorkflow,
};

export {
  studentOnboardingWorkflow,
  teacherOnboardingWorkflow,
  teacherRequestWorkflow,
  videoSessionWorkflow,
  contentCorrectionWorkflow,
  teacherPaymentWorkflow,
};
