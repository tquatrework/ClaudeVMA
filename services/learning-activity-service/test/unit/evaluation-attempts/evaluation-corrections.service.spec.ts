/**
 * Unit tests — EvaluationCorrectionsService
 *
 * Couvre :
 *   - accept()  → premier arrivé premier servi (2e accept échoue), professeur
 *                 non lié refusé, RP en override depuis PENDING/ALL_DECLINED
 *   - decline() → refus individuel, bascule ALL_DECLINED quand tous ont
 *                 refusé (relu en direct, pas la seule photo de création)
 *   - correct() → réservé à celui qui a accepté, refuse une correction vide
 *   - pending() / mine() / findOne() → visibilité par rôle
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EvaluationCorrectionsService } from '../../../src/evaluation-attempts/evaluation-corrections.service';
import { EvaluationCorrectionRequest } from '../../../src/evaluation-attempts/entities/evaluation-correction-request.entity';
import { EvaluationAttempt } from '../../../src/evaluation-attempts/entities/evaluation-attempt.entity';
import { ProfileRelationsClientService } from '../../../src/evaluation-attempts/profile-relations-client.service';
import { EventsService } from '../../../src/evaluation-attempts/events/events.service';
import {
  EVALUATION_CORRECTION_ACCEPTED,
  EVALUATION_CORRECTION_DECLINED,
  EVALUATION_CORRECTION_ALL_DECLINED,
  EVALUATION_CORRECTED,
} from '../../../src/evaluation-attempts/events/evaluation-event-types';
import { EvaluationCorrectionStatus } from '../../../src/common/enums/evaluation-correction-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const STUDENT_ID = 'el-0000-4000-c000-cccccccccccc';
const TEACHER_1 = 't-0000-4000-a000-aaaaaaaaaaaa';
const TEACHER_2 = 't-0000-4000-a000-bbbbbbbbbbbb';
const RP_ID = 'rp-0000-4000-a000-cccccccccccc';
const REQUEST_ID = 'req-0000-4000-b000-dddddddddddd';
const ATTEMPT_ID = 'at-0000-4000-b000-eeeeeeeeeeee';
const EVALUATION_ID = 'ev-0000-4000-a000-ffffffffffff';

function buildMockRepo() {
  return { create: jest.fn((data) => data), save: jest.fn(), find: jest.fn(), findOne: jest.fn() };
}

function buildSampleRequest(
  overrides: Partial<EvaluationCorrectionRequest> = {},
): EvaluationCorrectionRequest {
  return {
    id: REQUEST_ID,
    attemptId: ATTEMPT_ID,
    evaluationId: EVALUATION_ID,
    studentId: STUDENT_ID,
    status: EvaluationCorrectionStatus.PENDING,
    linkedTeacherIds: [TEACHER_1, TEACHER_2],
    declinedByTeacherIds: [],
    acceptedByTeacherId: null,
    score: null,
    comment: null,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    acceptedAt: null,
    correctedAt: null,
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  };
}

describe('EvaluationCorrectionsService', () => {
  let service: EvaluationCorrectionsService;
  let correctionRepo: ReturnType<typeof buildMockRepo>;
  let attemptRepo: ReturnType<typeof buildMockRepo>;
  let relationsClient: { getLinkedTeacherIds: jest.Mock };
  let eventsService: { emit: jest.Mock };

  beforeEach(async () => {
    correctionRepo = buildMockRepo();
    attemptRepo = buildMockRepo();
    relationsClient = { getLinkedTeacherIds: jest.fn() };
    eventsService = { emit: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationCorrectionsService,
        { provide: getRepositoryToken(EvaluationCorrectionRequest), useValue: correctionRepo },
        { provide: getRepositoryToken(EvaluationAttempt), useValue: attemptRepo },
        { provide: ProfileRelationsClientService, useValue: relationsClient },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = moduleRef.get(EvaluationCorrectionsService);
  });

  describe('accept', () => {
    it('renvoie 404 si la demande est introuvable', async () => {
      correctionRepo.findOne.mockResolvedValue(null);

      await expect(service.accept(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('un professeur non lié à l\'élève est refusé', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      relationsClient.getLinkedTeacherIds.mockResolvedValue([TEACHER_2]);

      await expect(service.accept(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('accepte pour le premier professeur lié qui accepte', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      relationsClient.getLinkedTeacherIds.mockResolvedValue([TEACHER_1, TEACHER_2]);
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.accept(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR, 'corr-1');

      expect(result.status).toBe(EvaluationCorrectionStatus.ACCEPTED);
      expect(result.acceptedByTeacherId).toBe(TEACHER_1);
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTION_ACCEPTED,
        expect.objectContaining({ teacherId: TEACHER_1 }),
        'corr-1',
      );
    });

    it('un second accept échoue explicitement (premier arrivé, premier servi)', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({ status: EvaluationCorrectionStatus.ACCEPTED, acceptedByTeacherId: TEACHER_1 }),
      );

      await expect(service.accept(REQUEST_ID, TEACHER_2, UserRole.FORMATEUR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('le RP peut accepter depuis PENDING', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.accept(REQUEST_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.status).toBe(EvaluationCorrectionStatus.ACCEPTED);
      expect(result.acceptedByTeacherId).toBe(RP_ID);
      expect(relationsClient.getLinkedTeacherIds).not.toHaveBeenCalled();
    });

    it('le RP peut accepter en override depuis ALL_DECLINED', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({
          status: EvaluationCorrectionStatus.ALL_DECLINED,
          declinedByTeacherIds: [TEACHER_1, TEACHER_2],
        }),
      );
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.accept(REQUEST_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.status).toBe(EvaluationCorrectionStatus.ACCEPTED);
    });

    it('un rôle non autorisé (ex. élève) est refusé', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());

      await expect(service.accept(REQUEST_ID, STUDENT_ID, UserRole.ELEVE)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('decline', () => {
    it('un rôle non formateur est refusé', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());

      await expect(
        service.decline(REQUEST_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un professeur non lié est refusé', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      relationsClient.getLinkedTeacherIds.mockResolvedValue([TEACHER_2]);

      await expect(service.decline(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuse individuellement sans basculer si d\'autres professeurs liés n\'ont pas encore répondu', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      relationsClient.getLinkedTeacherIds.mockResolvedValue([TEACHER_1, TEACHER_2]);
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.decline(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR, 'corr-1');

      expect(result.status).toBe(EvaluationCorrectionStatus.PENDING);
      expect(result.declinedByTeacherIds).toContain(TEACHER_1);
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTION_DECLINED,
        expect.objectContaining({ teacherId: TEACHER_1 }),
        'corr-1',
      );
      expect(eventsService.emit).not.toHaveBeenCalledWith(
        EVALUATION_CORRECTION_ALL_DECLINED,
        expect.anything(),
        expect.anything(),
      );
    });

    it('bascule en ALL_DECLINED quand tous les professeurs actuellement liés ont refusé', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({ declinedByTeacherIds: [TEACHER_1] }),
      );
      relationsClient.getLinkedTeacherIds.mockResolvedValue([TEACHER_1, TEACHER_2]);
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.decline(REQUEST_ID, TEACHER_2, UserRole.FORMATEUR, 'corr-1');

      expect(result.status).toBe(EvaluationCorrectionStatus.ALL_DECLINED);
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTION_ALL_DECLINED,
        expect.objectContaining({ reason: 'all_linked_teachers_declined' }),
        'corr-1',
      );
    });

    it('refuse si la demande n\'est plus en attente', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({ status: EvaluationCorrectionStatus.ACCEPTED }),
      );

      await expect(service.decline(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('correct', () => {
    it('refuse une correction sans score ni commentaire', async () => {
      await expect(
        service.correct(REQUEST_ID, {}, TEACHER_1),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse si la demande n\'est pas ACCEPTED', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());

      await expect(
        service.correct(REQUEST_ID, { score: 15 }, TEACHER_1),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse si l\'appelant n\'est pas celui qui a accepté', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({ status: EvaluationCorrectionStatus.ACCEPTED, acceptedByTeacherId: TEACHER_1 }),
      );

      await expect(
        service.correct(REQUEST_ID, { score: 15 }, TEACHER_2),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enregistre la correction et émet EvaluationCorrected', async () => {
      correctionRepo.findOne.mockResolvedValue(
        buildSampleRequest({ status: EvaluationCorrectionStatus.ACCEPTED, acceptedByTeacherId: TEACHER_1 }),
      );
      correctionRepo.save.mockImplementation(async (data) => data);

      const result = await service.correct(
        REQUEST_ID,
        { score: 15, comment: 'Bon travail' },
        TEACHER_1,
        'corr-1',
      );

      expect(result.status).toBe(EvaluationCorrectionStatus.CORRECTED);
      expect(result.score).toBe(15);
      expect(result.comment).toBe('Bon travail');
      expect(eventsService.emit).toHaveBeenCalledWith(
        EVALUATION_CORRECTED,
        expect.objectContaining({ teacherId: TEACHER_1, score: 15, comment: 'Bon travail' }),
        'corr-1',
      );
    });
  });

  describe('pending', () => {
    it('le RP voit toutes les demandes PENDING et ALL_DECLINED', async () => {
      correctionRepo.find.mockResolvedValue([buildSampleRequest()]);

      const result = await service.pending(RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result).toHaveLength(1);
      expect(correctionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { status: EvaluationCorrectionStatus.PENDING },
            { status: EvaluationCorrectionStatus.ALL_DECLINED },
          ],
        }),
      );
    });

    it('un professeur ne voit que les demandes où il est lié et n\'a pas refusé', async () => {
      correctionRepo.find.mockResolvedValue([
        buildSampleRequest({ linkedTeacherIds: [TEACHER_1, TEACHER_2] }),
        buildSampleRequest({ id: 'req-2', linkedTeacherIds: [TEACHER_2] }),
        buildSampleRequest({ id: 'req-3', linkedTeacherIds: [TEACHER_1], declinedByTeacherIds: [TEACHER_1] }),
      ]);

      const result = await service.pending(TEACHER_1, UserRole.FORMATEUR);

      expect(result.map((r) => r.id)).toEqual([REQUEST_ID]);
    });

    it('un rôle non autorisé est refusé', async () => {
      await expect(service.pending(STUDENT_ID, UserRole.ELEVE)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('mine', () => {
    it('renvoie les demandes acceptées par l\'appelant', async () => {
      correctionRepo.find.mockResolvedValue([buildSampleRequest({ acceptedByTeacherId: TEACHER_1 })]);

      const result = await service.mine(TEACHER_1, UserRole.FORMATEUR);

      expect(correctionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { acceptedByTeacherId: TEACHER_1 } }),
      );
      expect(result).toHaveLength(1);
    });

    it('un rôle non autorisé est refusé', async () => {
      await expect(service.mine(STUDENT_ID, UserRole.ELEVE)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('renvoie 404 si la demande est introuvable', async () => {
      correctionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(REQUEST_ID, STUDENT_ID, UserRole.ELEVE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuse un tiers sans droit sur la demande', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest({ linkedTeacherIds: [TEACHER_1] }));

      await expect(
        service.findOne(REQUEST_ID, 'un-autre-formateur', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('joint les réponses de la tentative pour l\'élève', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest());
      attemptRepo.findOne.mockResolvedValue({ answers: [{ exerciseId: 'ex-1', partId: 'p-1', content: [], answeredAt: '2026-09-01T10:00:00Z' }] });

      const result = await service.findOne(REQUEST_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.attemptAnswers).toHaveLength(1);
    });

    it('ne joint pas les réponses pour un professeur lié mais non accepteur (visible mais pas les réponses ? — ici les liés voient aussi)', async () => {
      correctionRepo.findOne.mockResolvedValue(buildSampleRequest({ linkedTeacherIds: [TEACHER_1] }));
      attemptRepo.findOne.mockResolvedValue({ answers: [] });

      const result = await service.findOne(REQUEST_ID, TEACHER_1, UserRole.FORMATEUR);

      expect(result.attemptAnswers).toEqual([]);
    });
  });
});
