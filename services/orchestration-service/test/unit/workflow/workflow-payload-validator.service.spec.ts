import { BadRequestException } from '@nestjs/common';
import { WorkflowPayloadValidatorService } from '../../../src/workflow/workflow-payload-validator.service';
import { studentOnboardingWorkflow } from '../../../src/workflow/definitions/student-onboarding.workflow';
import { teacherOnboardingWorkflow } from '../../../src/workflow/definitions/teacher-onboarding.workflow';
import { teacherRequestWorkflow } from '../../../src/workflow/definitions/teacher-request.workflow';

describe('WorkflowPayloadValidatorService', () => {
  let validator: WorkflowPayloadValidatorService;

  beforeEach(() => {
    validator = new WorkflowPayloadValidatorService();
  });

  describe('workflows without a startPayloadValidationClass', () => {
    it('does not validate anything and always resolves', async () => {
      await expect(
        validator.validateStartPayload(teacherRequestWorkflow, {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('student-onboarding', () => {
    it('accepts a payload with firstName and lastName', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {
          email: 'eleve@test.com',
          password: 'P@ss1234',
          firstName: 'Jean',
          lastName: 'Dupont',
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects a payload missing firstName', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {
          email: 'eleve@test.com',
          password: 'P@ss1234',
          lastName: 'Dupont',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a payload missing lastName', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {
          email: 'eleve@test.com',
          password: 'P@ss1234',
          firstName: 'Jean',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty payload with a clear error message', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {}),
      ).rejects.toThrow(/firstName est requis/);
    });

    it('accepts a payload without parentAccountId', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {
          firstName: 'Jean',
          lastName: 'Dupont',
        }),
      ).resolves.toBeUndefined();
    });

    it('accepts a payload with only parentAccountId — it links an existing parent by id, no name required', async () => {
      await expect(
        validator.validateStartPayload(studentOnboardingWorkflow, {
          firstName: 'Jean',
          lastName: 'Dupont',
          parentAccountId: 'parent-1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('teacher-onboarding', () => {
    it('accepts a payload with firstName and lastName', async () => {
      await expect(
        validator.validateStartPayload(teacherOnboardingWorkflow, {
          email: 'formateur@test.com',
          password: 'P@ss1234',
          firstName: 'Marie',
          lastName: 'Martin',
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects a payload missing firstName and lastName', async () => {
      await expect(
        validator.validateStartPayload(teacherOnboardingWorkflow, {
          email: 'formateur@test.com',
          password: 'P@ss1234',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
