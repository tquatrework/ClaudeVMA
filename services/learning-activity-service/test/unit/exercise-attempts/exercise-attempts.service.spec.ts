/**
 * Unit tests — ExerciseAttemptsService
 *
 * Couvre :
 *   - start()           → seuls élèves/formateurs/RP/AP peuvent démarrer une tentative ;
 *                          lit la structure (blocs question uniquement) et seed les parts
 *   - submitAnswer()     → idempotent (remplace), rôle refusé, tentative introuvable/non
 *                          possédée, bloc question inexistant
 *   - reveal()           → médiation content-catalog-service, mise en cache (pas de second
 *                          appel), rôle refusé, tentative/bloc introuvables, échec amont propagé
 *   - getRevealedImage() → sert uniquement une image appartenant à une solution déjà révélée
 *                          sur cette tentative (pas d'id orphelin), rôle refusé, tentative
 *                          d'un tiers refusée, échec amont propagé
 *   - findOne()          → calcul du statut done/in_progress
 *   - history()          → tentatives passées ET en cours de l'utilisateur
 *
 * Les items de réponse/solution utilisent le champ `content` (pas `value`),
 * conformément au contrat confirmé par content-catalog-service (PR #184).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExerciseAttemptsService } from '../../../src/exercise-attempts/exercise-attempts.service';
import { ExerciseAttempt } from '../../../src/exercise-attempts/entities/exercise-attempt.entity';
import { ExerciseAttemptPart } from '../../../src/exercise-attempts/entities/exercise-attempt-part.entity';
import { ExerciseContentItemType } from '../../../src/exercise-attempts/dto/exercise-content-item.dto';
import { ExerciseStructureClientService } from '../../../src/exercise-attempts/exercise-structure-client.service';
import { ExerciseSolutionClientService } from '../../../src/exercise-attempts/exercise-solution-client.service';
import { ExerciseAttemptStatus } from '../../../src/common/enums/exercise-attempt-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const OTHER_ELEVE_ID = 'el-0000-4000-c000-dddddddddddd';
const EXERCISE_ID = 'ex-0000-4000-a000-aaaaaaaaaaaa';
const ATTEMPT_ID = 'at-0000-4000-b000-bbbbbbbbbbbb';
const PART_Q1 = 'part-q1';
const PART_Q2 = 'part-q2';
const IMAGE_ITEM_ID = 'item-0000-4000-c000-cccccccccccc';

function buildMockRepo() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildSampleAttempt(overrides: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: ATTEMPT_ID,
    exerciseId: EXERCISE_ID,
    userId: ELEVE_ID,
    userRole: UserRole.ELEVE,
    startedAt: new Date('2026-08-29T10:00:00Z'),
    updatedAt: new Date('2026-08-29T10:00:00Z'),
    ...overrides,
  };
}

function buildSamplePart(overrides: Partial<ExerciseAttemptPart> = {}): ExerciseAttemptPart {
  return {
    id: `row-${overrides.partId ?? PART_Q1}`,
    attemptId: ATTEMPT_ID,
    partId: PART_Q1,
    answerContent: null,
    answeredAt: null,
    solutionRevealed: false,
    revealedAt: null,
    revealedContent: null,
    createdAt: new Date('2026-08-29T10:00:00Z'),
    updatedAt: new Date('2026-08-29T10:00:00Z'),
    ...overrides,
  };
}

describe('ExerciseAttemptsService', () => {
  let service: ExerciseAttemptsService;
  let attemptRepo: ReturnType<typeof buildMockRepo>;
  let partRepo: ReturnType<typeof buildMockRepo>;
  let structureClient: { getStructure: jest.Mock };
  let solutionClient: { reveal: jest.Mock; getImageBytes: jest.Mock };

  beforeEach(async () => {
    attemptRepo = buildMockRepo();
    partRepo = buildMockRepo();
    structureClient = { getStructure: jest.fn() };
    solutionClient = { reveal: jest.fn(), getImageBytes: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseAttemptsService,
        { provide: getRepositoryToken(ExerciseAttempt), useValue: attemptRepo },
        { provide: getRepositoryToken(ExerciseAttemptPart), useValue: partRepo },
        { provide: ExerciseStructureClientService, useValue: structureClient },
        { provide: ExerciseSolutionClientService, useValue: solutionClient },
      ],
    }).compile();

    service = moduleRef.get(ExerciseAttemptsService);
  });

  describe('start', () => {
    it('démarre une tentative pour un élève et ne garde que les blocs question', async () => {
      structureClient.getStructure.mockResolvedValue({
        id: EXERCISE_ID,
        parts: [
          { id: 'stmt-1', category: 'statement' },
          { id: PART_Q1, category: 'question' },
          { id: PART_Q2, category: 'question' },
        ],
      });
      const attempt = buildSampleAttempt();
      attemptRepo.save.mockResolvedValue(attempt);
      const parts = [buildSamplePart({ partId: PART_Q1 }), buildSamplePart({ partId: PART_Q2 })];
      partRepo.save.mockResolvedValue(parts);

      const result = await service.start(
        { exerciseId: EXERCISE_ID },
        ELEVE_ID,
        UserRole.ELEVE,
        'Bearer token-abc',
        'corr-1',
      );

      expect(structureClient.getStructure).toHaveBeenCalledWith(EXERCISE_ID, 'Bearer token-abc', 'corr-1');
      expect(partRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ attemptId: ATTEMPT_ID, partId: PART_Q1 }),
        expect.objectContaining({ attemptId: ATTEMPT_ID, partId: PART_Q2 }),
      ]);
      expect(result.parts).toHaveLength(2);
      expect(result.status).toBe(ExerciseAttemptStatus.IN_PROGRESS);
    });

    it.each([UserRole.FORMATEUR, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ANIMATEUR_PEDAGOGIQUE])(
      'démarre une tentative pour le rôle %s',
      async (role) => {
        structureClient.getStructure.mockResolvedValue({ id: EXERCISE_ID, parts: [] });
        attemptRepo.save.mockResolvedValue(buildSampleAttempt({ userRole: role }));

        await expect(
          service.start({ exerciseId: EXERCISE_ID }, ELEVE_ID, role, 'Bearer x'),
        ).resolves.toBeDefined();
      },
    );

    it('refuse un rôle non autorisé (parent financeur) avant tout appel', async () => {
      await expect(
        service.start({ exerciseId: EXERCISE_ID }, ELEVE_ID, UserRole.PARENT_FINANCEUR, 'Bearer x'),
      ).rejects.toThrow(ForbiddenException);
      expect(structureClient.getStructure).not.toHaveBeenCalled();
      expect(attemptRepo.save).not.toHaveBeenCalled();
    });

    it('un exercice sans bloc question est démarré comme fait (vérité vacueuse)', async () => {
      structureClient.getStructure.mockResolvedValue({
        id: EXERCISE_ID,
        parts: [{ id: 'stmt-1', category: 'statement' }],
      });
      attemptRepo.save.mockResolvedValue(buildSampleAttempt());

      const result = await service.start({ exerciseId: EXERCISE_ID }, ELEVE_ID, UserRole.ELEVE, 'Bearer x');

      expect(partRepo.save).not.toHaveBeenCalled();
      expect(result.parts).toEqual([]);
      expect(result.status).toBe(ExerciseAttemptStatus.DONE);
    });

    it('propage une erreur si content-catalog-service est injoignable, sans créer de tentative', async () => {
      structureClient.getStructure.mockRejectedValue(new ServiceUnavailableException('injoignable'));

      await expect(
        service.start({ exerciseId: EXERCISE_ID }, ELEVE_ID, UserRole.ELEVE, 'Bearer x'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(attemptRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('submitAnswer', () => {
    it('enregistre une réponse pour un bloc existant', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const part = buildSamplePart({ partId: PART_Q1 });
      partRepo.findOne.mockResolvedValue(part);
      partRepo.save.mockImplementation((value) => Promise.resolve(value));
      partRepo.find.mockResolvedValue([
        { ...part, answerContent: [{ type: 'text', content: '42' }], answeredAt: new Date() },
      ]);

      const result = await service.submitAnswer(
        ATTEMPT_ID,
        { partId: PART_Q1, content: [{ type: ExerciseContentItemType.TEXT, content: '42' }] },
        ELEVE_ID,
        UserRole.ELEVE,
      );

      expect(partRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          partId: PART_Q1,
          answerContent: [{ type: 'text', content: '42' }],
        }),
      );
      expect(result.parts[0].answerContent).toEqual([{ type: 'text', content: '42' }]);
    });

    it('remplace la réponse précédente pour le même bloc (idempotent)', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const existingPart = buildSamplePart({
        partId: PART_Q1,
        answerContent: [{ type: 'text', content: 'ancienne réponse' }],
        answeredAt: new Date('2026-08-29T09:00:00Z'),
      });
      partRepo.findOne.mockResolvedValue(existingPart);
      partRepo.save.mockImplementation((value) => Promise.resolve(value));
      partRepo.find.mockResolvedValue([existingPart]);

      await service.submitAnswer(
        ATTEMPT_ID,
        { partId: PART_Q1, content: [{ type: ExerciseContentItemType.TEXT, content: 'nouvelle réponse' }] },
        ELEVE_ID,
        UserRole.ELEVE,
      );

      expect(existingPart.answerContent).toEqual([{ type: 'text', content: 'nouvelle réponse' }]);
      expect(partRepo.save).toHaveBeenCalledTimes(1);
    });

    it('renvoie 404 si le bloc question est inexistant pour cette tentative', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      partRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitAnswer(
          ATTEMPT_ID,
          { partId: 'part-inconnu', content: [{ type: ExerciseContentItemType.TEXT, content: 'x' }] },
          ELEVE_ID,
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(partRepo.save).not.toHaveBeenCalled();
    });

    it('renvoie 404 si la tentative est introuvable', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitAnswer(
          ATTEMPT_ID,
          { partId: PART_Q1, content: [{ type: ExerciseContentItemType.TEXT, content: 'x' }] },
          ELEVE_ID,
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('renvoie 404 si la tentative appartient à un tiers (pas de fuite d\'existence)', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ userId: OTHER_ELEVE_ID }));

      await expect(
        service.submitAnswer(
          ATTEMPT_ID,
          { partId: PART_Q1, content: [{ type: ExerciseContentItemType.TEXT, content: 'x' }] },
          ELEVE_ID,
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(partRepo.findOne).not.toHaveBeenCalled();
    });

    it('refuse un rôle non autorisé avant même de chercher la tentative', async () => {
      await expect(
        service.submitAnswer(
          ATTEMPT_ID,
          { partId: PART_Q1, content: [{ type: ExerciseContentItemType.TEXT, content: 'x' }] },
          ELEVE_ID,
          UserRole.PARENT_FINANCEUR,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(attemptRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('reveal', () => {
    it('révèle une solution jamais révélée en appelant content-catalog-service', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const part = buildSamplePart({ partId: PART_Q1 });
      partRepo.findOne.mockResolvedValue(part);
      solutionClient.reveal.mockResolvedValue({
        content: [{ id: 'i1', type: 'text', order: 0, content: 'x = 2' }],
      });
      partRepo.save.mockImplementation((value) => Promise.resolve(value));
      partRepo.find.mockResolvedValue([
        {
          ...part,
          solutionRevealed: true,
          revealedContent: [{ id: 'i1', type: 'text', order: 0, content: 'x = 2' }],
        },
      ]);

      const result = await service.reveal(
        ATTEMPT_ID,
        { partId: PART_Q1 },
        ELEVE_ID,
        UserRole.ELEVE,
        'corr-1',
      );

      expect(solutionClient.reveal).toHaveBeenCalledWith(EXERCISE_ID, PART_Q1, 'corr-1');
      expect(part.solutionRevealed).toBe(true);
      expect(part.revealedAt).toBeInstanceOf(Date);
      expect(result.parts[0].revealedContent).toEqual([
        { id: 'i1', type: 'text', order: 0, content: 'x = 2' },
      ]);
    });

    it('révèle une solution avec un item image (id de l\'item = référence de l\'image)', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const part = buildSamplePart({ partId: PART_Q1 });
      partRepo.findOne.mockResolvedValue(part);
      const imageItem = {
        id: IMAGE_ITEM_ID,
        type: 'image',
        order: 0,
        content: '',
        imageMimeType: 'image/png',
        imageSizeBytes: 4096,
      };
      solutionClient.reveal.mockResolvedValue({ content: [imageItem] });
      partRepo.save.mockImplementation((value) => Promise.resolve(value));
      partRepo.find.mockResolvedValue([
        { ...part, solutionRevealed: true, revealedContent: [imageItem] },
      ]);

      const result = await service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.ELEVE);

      expect(result.parts[0].revealedContent).toEqual([imageItem]);
    });

    it('ne rappelle pas content-catalog-service pour une solution déjà révélée (idempotent)', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const alreadyRevealedPart = buildSamplePart({
        partId: PART_Q1,
        solutionRevealed: true,
        revealedAt: new Date('2026-08-29T09:30:00Z'),
        revealedContent: [{ id: 'i1', type: 'text', order: 0, content: 'déjà révélée' }],
      });
      partRepo.findOne.mockResolvedValue(alreadyRevealedPart);
      partRepo.find.mockResolvedValue([alreadyRevealedPart]);

      const result = await service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.ELEVE);

      expect(solutionClient.reveal).not.toHaveBeenCalled();
      expect(partRepo.save).not.toHaveBeenCalled();
      expect(result.parts[0].revealedContent).toEqual([
        { id: 'i1', type: 'text', order: 0, content: 'déjà révélée' },
      ]);
    });

    it('renvoie 404 si le bloc question est inexistant pour cette tentative', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      partRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reveal(ATTEMPT_ID, { partId: 'part-inconnu' }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(solutionClient.reveal).not.toHaveBeenCalled();
    });

    it('renvoie 404 si la tentative appartient à un tiers', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ userId: OTHER_ELEVE_ID }));

      await expect(
        service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(solutionClient.reveal).not.toHaveBeenCalled();
    });

    it('refuse un rôle non autorisé avant même de chercher la tentative', async () => {
      await expect(
        service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(attemptRepo.findOne).not.toHaveBeenCalled();
    });

    it(
      'propage une 404 telle quelle si content-catalog-service la renvoie ' +
        '(partId inexistant, bloc statement, ou bloc question sans solution — un seul comportement, jamais de 400 distinct)',
      async () => {
        const attempt = buildSampleAttempt();
        attemptRepo.findOne.mockResolvedValue(attempt);
        const part = buildSamplePart({ partId: PART_Q1 });
        partRepo.findOne.mockResolvedValue(part);
        solutionClient.reveal.mockRejectedValue(new NotFoundException('Solution introuvable'));

        await expect(
          service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.ELEVE),
        ).rejects.toThrow(NotFoundException);
        expect(part.solutionRevealed).toBe(false);
        expect(partRepo.save).not.toHaveBeenCalled();
      },
    );

    it('propage un échec de content-catalog-service sans marquer la solution comme révélée', async () => {
      const attempt = buildSampleAttempt();
      attemptRepo.findOne.mockResolvedValue(attempt);
      const part = buildSamplePart({ partId: PART_Q1 });
      partRepo.findOne.mockResolvedValue(part);
      solutionClient.reveal.mockRejectedValue(new ServiceUnavailableException('injoignable'));

      await expect(
        service.reveal(ATTEMPT_ID, { partId: PART_Q1 }, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(part.solutionRevealed).toBe(false);
      expect(partRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getRevealedImage', () => {
    it('renvoie les octets d\'une image appartenant à une solution déjà révélée sur cette tentative', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({
          partId: PART_Q1,
          solutionRevealed: true,
          revealedContent: [
            { id: IMAGE_ITEM_ID, type: 'image', order: 0, content: '', imageMimeType: 'image/png', imageSizeBytes: 100 },
          ],
        }),
      ]);
      const image = { buffer: Buffer.from([1, 2, 3]), contentType: 'image/png' };
      solutionClient.getImageBytes.mockResolvedValue(image);

      const result = await service.getRevealedImage(
        ATTEMPT_ID,
        IMAGE_ITEM_ID,
        ELEVE_ID,
        UserRole.ELEVE,
        'corr-1',
      );

      expect(solutionClient.getImageBytes).toHaveBeenCalledWith(IMAGE_ITEM_ID, 'corr-1');
      expect(result).toEqual(image);
    });

    it('renvoie 404 pour un itemId qui n\'appartient à aucune solution révélée de cette tentative (pas d\'id orphelin)', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({ partId: PART_Q1, solutionRevealed: false }),
      ]);

      await expect(
        service.getRevealedImage(ATTEMPT_ID, IMAGE_ITEM_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(solutionClient.getImageBytes).not.toHaveBeenCalled();
    });

    it('renvoie 404 si l\'image existe dans une solution révélée d\'un autre bloc mais pas celui demandé', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({
          partId: PART_Q1,
          solutionRevealed: true,
          revealedContent: [{ id: 'other-item', type: 'text', order: 0, content: 'x' }],
        }),
      ]);

      await expect(
        service.getRevealedImage(ATTEMPT_ID, IMAGE_ITEM_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(solutionClient.getImageBytes).not.toHaveBeenCalled();
    });

    it('renvoie 404 si la tentative appartient à un tiers', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ userId: OTHER_ELEVE_ID }));

      await expect(
        service.getRevealedImage(ATTEMPT_ID, IMAGE_ITEM_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
      expect(solutionClient.getImageBytes).not.toHaveBeenCalled();
    });

    it('refuse un rôle non autorisé avant même de chercher la tentative', async () => {
      await expect(
        service.getRevealedImage(ATTEMPT_ID, IMAGE_ITEM_ID, ELEVE_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
      expect(attemptRepo.findOne).not.toHaveBeenCalled();
    });

    it('propage un échec de content-catalog-service lors de la récupération des octets', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({
          partId: PART_Q1,
          solutionRevealed: true,
          revealedContent: [{ id: IMAGE_ITEM_ID, type: 'image', order: 0, content: '' }],
        }),
      ]);
      solutionClient.getImageBytes.mockRejectedValue(new ServiceUnavailableException('injoignable'));

      await expect(
        service.getRevealedImage(ATTEMPT_ID, IMAGE_ITEM_ID, ELEVE_ID, UserRole.ELEVE),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('findOne', () => {
    it('statut "done" quand toutes les solutions sont révélées', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({ partId: PART_Q1, solutionRevealed: true }),
        buildSamplePart({ partId: PART_Q2, solutionRevealed: true }),
      ]);

      const result = await service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.status).toBe(ExerciseAttemptStatus.DONE);
    });

    it('statut "done" quand toutes les questions ont reçu une réponse', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({ partId: PART_Q1, answerContent: [{ type: 'text', content: 'a' }] }),
        buildSamplePart({ partId: PART_Q2, answerContent: [{ type: 'text', content: 'b' }] }),
      ]);

      const result = await service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.status).toBe(ExerciseAttemptStatus.DONE);
    });

    it('statut "in_progress" si ni toutes révélées ni toutes répondues', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt());
      partRepo.find.mockResolvedValue([
        buildSamplePart({ partId: PART_Q1, answerContent: [{ type: 'text', content: 'a' }] }),
        buildSamplePart({ partId: PART_Q2 }),
      ]);

      const result = await service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE);

      expect(result.status).toBe(ExerciseAttemptStatus.IN_PROGRESS);
    });

    it('renvoie 404 si la tentative est introuvable', async () => {
      attemptRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('renvoie 404 si la tentative appartient à un tiers', async () => {
      attemptRepo.findOne.mockResolvedValue(buildSampleAttempt({ userId: OTHER_ELEVE_ID }));

      await expect(service.findOne(ATTEMPT_ID, ELEVE_ID, UserRole.ELEVE)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('history', () => {
    it('renvoie les tentatives passées ET en cours de l\'utilisateur, avec leur statut', async () => {
      const inProgress = buildSampleAttempt({ id: 'a1' });
      const done = buildSampleAttempt({ id: 'a2' });
      attemptRepo.find.mockResolvedValue([done, inProgress]);
      partRepo.find.mockImplementation(({ where }: { where: { attemptId: string } }) => {
        if (where.attemptId === 'a2') {
          return Promise.resolve([buildSamplePart({ partId: PART_Q1, solutionRevealed: true })]);
        }
        return Promise.resolve([buildSamplePart({ partId: PART_Q1 })]);
      });

      const result = await service.history(ELEVE_ID);

      expect(attemptRepo.find).toHaveBeenCalledWith({
        where: { userId: ELEVE_ID },
        order: { startedAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result.find((a) => a.id === 'a2')?.status).toBe(ExerciseAttemptStatus.DONE);
      expect(result.find((a) => a.id === 'a1')?.status).toBe(ExerciseAttemptStatus.IN_PROGRESS);
    });
  });
});
