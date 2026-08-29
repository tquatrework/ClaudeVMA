/**
 * Unit tests — ExercisesService, gestion des images et de la route interne
 * de solution (refonte du 2026-08-29).
 *
 * Couvre :
 *   - addImageToPart()             → réservé à l'auteur, fait repasser en
 *                                     pending_validation, ré-encodage via le
 *                                     transcoder injecté
 *   - addImageToSolution()         → réservé à l'auteur, bloc question requis
 *   - getPartImageForDownload()    → jamais une image de solution (404)
 *   - getImageForInternalDownload()→ toute image, sans vérification de visibilité
 *   - getSolutionContentForInternal() → jamais exposée hors de la route interne
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ExercisesService } from '../../../src/exercises/exercises.service';
import { Exercise } from '../../../src/exercises/entities/exercise.entity';
import { ExercisePart } from '../../../src/exercises/entities/exercise-part.entity';
import { ExerciseSolution } from '../../../src/exercises/entities/exercise-solution.entity';
import { ExerciseContentItem } from '../../../src/exercises/entities/exercise-content-item.entity';
import { ExercisePartCategory } from '../../../src/exercises/enums/exercise-part-category.enum';
import { ContentStatus } from '../../../src/common/enums/content-status.enum';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';
import { ExerciseImageStorageService } from '../../../src/exercises/exercise-image-storage.service';
import { ExerciseImageTranscoder } from '../../../src/exercises/exercise-image-transcoder';
import { EXERCISE_IMAGE_MAX_BYTES } from '../../../src/exercises/exercise.constants';

const FORMATEUR_ID = 'form-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_ID = 'othe-0000-4000-b000-bbbbbbbbbbbb';
const EXERCISE_ID = 'exer-0000-4000-c000-cccccccccccc';
const PART_ID = 'part-0000-4000-d000-dddddddddddd';

function buildMockRepo() {
  return {
    create: jest.fn((x) => x),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('ExercisesService — images et route interne', () => {
  let service: ExercisesService;
  let exerciseRepo: ReturnType<typeof buildMockRepo>;
  let partRepo: ReturnType<typeof buildMockRepo>;
  let solutionRepo: ReturnType<typeof buildMockRepo>;
  let itemRepo: ReturnType<typeof buildMockRepo>;
  let imageStorage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let imageTranscoder: { transcode: jest.Mock };

  const exercise = {
    id: EXERCISE_ID,
    authorId: FORMATEUR_ID,
    authorRole: 'formateur',
    status: ContentStatus.VALIDATED,
  } as Exercise;

  const questionPart = { id: PART_ID, exerciseId: EXERCISE_ID, category: ExercisePartCategory.QUESTION } as ExercisePart;
  const statementPart = { id: PART_ID, exerciseId: EXERCISE_ID, category: ExercisePartCategory.STATEMENT } as ExercisePart;

  const validFile = { originalname: 'photo.png', buffer: Buffer.from('fake'), size: 1000 } as Express.Multer.File;

  beforeEach(async () => {
    exerciseRepo = buildMockRepo();
    partRepo = buildMockRepo();
    solutionRepo = buildMockRepo();
    itemRepo = buildMockRepo();
    imageStorage = { save: jest.fn().mockResolvedValue('stored-uuid'), read: jest.fn(), delete: jest.fn() };
    imageTranscoder = {
      transcode: jest.fn().mockResolvedValue({
        bytes: Buffer.from('encoded'),
        contentType: 'image/webp',
        width: 100,
        height: 100,
        sourceFormat: 'png',
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: getRepositoryToken(Exercise), useValue: exerciseRepo },
        { provide: getRepositoryToken(ExercisePart), useValue: partRepo },
        { provide: getRepositoryToken(ExerciseSolution), useValue: solutionRepo },
        { provide: getRepositoryToken(ExerciseContentItem), useValue: itemRepo },
        { provide: ProfileRelationsClient, useValue: { hasAnimatorOfTeacherRelation: jest.fn() } },
        { provide: ExerciseImageStorageService, useValue: imageStorage },
        { provide: ExerciseImageTranscoder, useValue: imageTranscoder },
      ],
    }).compile();

    service = moduleRef.get<ExercisesService>(ExercisesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addImageToPart()', () => {
    it("ajoute une image et fait repasser l'exercice formateur en pending_validation", async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(statementPart);
      itemRepo.find.mockResolvedValue([]);
      itemRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'item-1' }));

      const result = await service.addImageToPart(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID);

      expect(imageTranscoder.transcode).toHaveBeenCalledWith(validFile.buffer);
      expect(imageStorage.save).toHaveBeenCalled();
      expect(exerciseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ContentStatus.PENDING_VALIDATION }));
      expect(result.type).toBe('image');
    });

    it('lève ForbiddenException si l\'appelant n\'est pas l\'auteur', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });

      await expect(
        service.addImageToPart(EXERCISE_ID, PART_ID, validFile, {}, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le bloc est introuvable', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      partRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addImageToPart(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si aucun fichier n\'est envoyé', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(statementPart);

      await expect(
        service.addImageToPart(EXERCISE_ID, PART_ID, undefined, {}, FORMATEUR_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève PayloadTooLargeException si l\'image ré-encodée dépasse le plafond', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(statementPart);
      imageTranscoder.transcode.mockResolvedValue({
        bytes: Buffer.alloc(EXERCISE_IMAGE_MAX_BYTES + 1),
        contentType: 'image/webp',
        width: 1,
        height: 1,
        sourceFormat: 'png',
      });

      await expect(
        service.addImageToPart(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID),
      ).rejects.toThrow(PayloadTooLargeException);
    });
  });

  describe('addImageToSolution()', () => {
    it('ajoute une image à la solution d\'un bloc question', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(questionPart);
      solutionRepo.findOne.mockResolvedValue({ id: 'sol-1', partId: PART_ID });
      itemRepo.find.mockResolvedValue([]);
      itemRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'item-1' }));

      const result = await service.addImageToSolution(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID);

      expect(result.type).toBe('image');
    });

    it('lève BadRequestException si le bloc n\'est pas une question', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(statementPart);

      await expect(
        service.addImageToSolution(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si la solution n\'existe pas', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise });
      exerciseRepo.save.mockResolvedValue({});
      partRepo.findOne.mockResolvedValue(questionPart);
      solutionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addImageToSolution(EXERCISE_ID, PART_ID, validFile, {}, FORMATEUR_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPartImageForDownload()', () => {
    it('sert une image de bloc si l\'exercice est visible', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise, parts: [] });
      itemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        type: 'image',
        partId: PART_ID,
        imageStoredFilename: 'stored-uuid',
        imageMimeType: 'image/webp',
      });
      partRepo.findOne.mockResolvedValue(statementPart);
      imageStorage.read.mockResolvedValue(Buffer.from('bytes'));

      const result = await service.getPartImageForDownload(EXERCISE_ID, 'item-1', FORMATEUR_ID, 'formateur');

      expect(result.buffer.toString()).toBe('bytes');
    });

    it('lève NotFoundException si l\'image appartient à une solution (jamais servie publiquement)', async () => {
      exerciseRepo.findOne.mockResolvedValue({ ...exercise, parts: [] });
      itemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        type: 'image',
        partId: null,
        solutionId: 'sol-1',
        imageStoredFilename: 'stored-uuid',
      });

      await expect(
        service.getPartImageForDownload(EXERCISE_ID, 'item-1', FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si l\'exercice n\'est pas visible pour l\'appelant', async () => {
      exerciseRepo.findOne.mockResolvedValue({
        ...exercise,
        status: ContentStatus.PENDING_VALIDATION,
        parts: [],
      });

      await expect(
        service.getPartImageForDownload(EXERCISE_ID, 'item-1', OTHER_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getImageForInternalDownload()', () => {
    it("sert n'importe quelle image (bloc ou solution) sans vérification de visibilité", async () => {
      itemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        type: 'image',
        solutionId: 'sol-1',
        imageStoredFilename: 'stored-uuid',
        imageMimeType: 'image/webp',
      });
      imageStorage.read.mockResolvedValue(Buffer.from('bytes'));

      const result = await service.getImageForInternalDownload('item-1');

      expect(result.buffer.toString()).toBe('bytes');
    });

    it('lève NotFoundException si l\'item n\'existe pas', async () => {
      itemRepo.findOne.mockResolvedValue(null);

      await expect(service.getImageForInternalDownload('item-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSolutionContentForInternal()', () => {
    it('retourne le contenu de la solution, y compris les images', async () => {
      partRepo.findOne.mockResolvedValue(questionPart);
      solutionRepo.findOne.mockResolvedValue({
        id: 'sol-1',
        items: [
          { id: 'i1', type: 'text', content: 'x = 2', order: 0 },
          { id: 'i2', type: 'image', content: null, order: 1, imageMimeType: 'image/webp', imageSizeBytes: 100 },
        ],
      });

      const content = await service.getSolutionContentForInternal(EXERCISE_ID, PART_ID);

      expect(content).toHaveLength(2);
      expect(content[1].type).toBe('image');
    });

    it('lève NotFoundException si le bloc est introuvable', async () => {
      partRepo.findOne.mockResolvedValue(null);

      await expect(service.getSolutionContentForInternal(EXERCISE_ID, PART_ID)).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si la solution est introuvable', async () => {
      partRepo.findOne.mockResolvedValue(questionPart);
      solutionRepo.findOne.mockResolvedValue(null);

      await expect(service.getSolutionContentForInternal(EXERCISE_ID, PART_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
