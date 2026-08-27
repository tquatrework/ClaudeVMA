/**
 * Unit tests — MemoService (assainissement backend, chantier feat/memo-formules)
 *
 * Le mémo est un outil de l'élève (formules/trucs essentiels). Écriture
 * réservée au titulaire élève (`assertIsEleve`) — CRITIQUE XML spec: seul
 * l'élève peut écrire → 403 pour tout autre rôle. Lecture ouverte au
 * titulaire et aux tiers reliés (formateur, RP/AP coordinateur, parent
 * financeur) ou administrateurs, via `assertCanRead` (B5) — vérifié à
 * chaque appel auprès de profile-service, jamais en cache.
 *
 * Couvre : CRUD complet chapitre/item par le titulaire, refus d'écriture
 * pour un tiers, lecture autorisée pour formateur/RP/parent liés, refus
 * pour un tiers non lié, échec fermé (503) si profile-service est
 * injoignable, plafonds (chapitres, items, taille image), upload d'image
 * avec détection réelle sur les octets, suppression du fichier image à la
 * suppression de l'item/du chapitre.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MemoService } from '../../../src/memo/memo.service';
import { MemoChapter } from '../../../src/memo/entities/memo-chapter.entity';
import { MemoItem } from '../../../src/memo/entities/memo-item.entity';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';
import { MemoImageStorageService } from '../../../src/memo/memo-image-storage.service';
import {
  MEMO_MAX_CHAPTERS_PER_STUDENT,
  MEMO_MAX_ITEMS_PER_CHAPTER,
} from '../../../src/memo/memo.constants';
import * as mimeDetector from '../../../src/attachments/attachment-mime-detector';

jest.mock('../../../src/attachments/attachment-mime-detector', () => {
  const actual = jest.requireActual('../../../src/attachments/attachment-mime-detector');
  return { ...actual, detectAttachmentMimeType: jest.fn() };
});

const STUDENT_ID = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_STUDENT = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const CHAPTER_ID = 'cccccccc-0000-4000-c000-cccccccccccc';
const ITEM_ID = 'dddddddd-0000-4000-d000-dddddddddddd';
const TEACHER_ID = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';

function buildSampleChapter(overrides: Partial<MemoChapter> = {}): MemoChapter {
  return {
    id: CHAPTER_ID,
    studentId: STUDENT_ID,
    title: 'Algèbre',
    order: 0,
    items: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as MemoChapter;
}

function buildSampleItem(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: ITEM_ID,
    chapterId: CHAPTER_ID,
    chapter: undefined as any,
    type: 'formula',
    content: '$\\frac{a}{b}$',
    imageOriginalFilename: null,
    imageStoredFilename: null,
    imageMimeType: null,
    imageSizeBytes: null,
    order: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as MemoItem;
}

function buildImageFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'formule.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1000,
    buffer: Buffer.from('fake png bytes'),
    ...overrides,
  } as Express.Multer.File;
}

describe('MemoService', () => {
  let memoService: MemoService;
  let mockChapterRepo: any;
  let mockItemRepo: any;
  let relationsClient: { getRelation: jest.Mock };
  let imageStorage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    mockChapterRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ ...data })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    mockItemRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: ITEM_ID, ...data })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    relationsClient = {
      // Par défaut : aucune relation, pas administrateur → 403 pour un tiers.
      getRelation: jest.fn().mockResolvedValue({
        viewerId: '',
        targetId: '',
        isSelf: false,
        isAdministrator: false,
        relations: [],
      }),
    };

    imageStorage = {
      save: jest.fn().mockResolvedValue('stored-image-uuid'),
      read: jest.fn().mockResolvedValue(Buffer.from('image bytes')),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue('image/png');

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MemoService,
        { provide: getRepositoryToken(MemoChapter), useValue: mockChapterRepo },
        { provide: getRepositoryToken(MemoItem), useValue: mockItemRepo },
        { provide: ProfileRelationsClient, useValue: relationsClient },
        { provide: MemoImageStorageService, useValue: imageStorage },
      ],
    }).compile();

    memoService = moduleRef.get<MemoService>(MemoService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────
  // createChapter()
  // ─────────────────────────────────────────────────────────────────────

  describe('createChapter()', () => {
    it('[OK] un élève peut créer un chapitre dans son propre mémo → 201', async () => {
      const dto = { title: 'Algèbre', order: 0 };
      mockChapterRepo.save.mockResolvedValue(buildSampleChapter());

      const result = await memoService.createChapter(STUDENT_ID, dto, STUDENT_ID, 'eleve');

      expect(mockChapterRepo.create).toHaveBeenCalledWith({
        studentId: STUDENT_ID,
        title: 'Algèbre',
        order: 0,
      });
      expect(result.studentId).toBe(STUDENT_ID);
    });

    it('[CRITIQUE] un formateur tente d\'écrire dans le mémo → 403 ForbiddenException', async () => {
      await expect(
        memoService.createChapter(STUDENT_ID, { title: 'Mes notes' }, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockChapterRepo.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un RP tente d\'écrire dans le mémo → 403 ForbiddenException', async () => {
      await expect(
        memoService.createChapter(STUDENT_ID, { title: 'Notes RP' }, 'rp-uuid', 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un élève tente de créer dans le mémo d\'un autre élève → 403 ForbiddenException', async () => {
      await expect(
        memoService.createChapter(STUDENT_ID, { title: 'Chapitre volé' }, OTHER_STUDENT, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] plafond de chapitres atteint → 400 BadRequestException', async () => {
      mockChapterRepo.count.mockResolvedValue(MEMO_MAX_CHAPTERS_PER_STUDENT);

      await expect(
        memoService.createChapter(STUDENT_ID, { title: 'Encore un' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
      expect(mockChapterRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findChapters() — GET /memos (titulaire)
  // ─────────────────────────────────────────────────────────────────────

  describe('findChapters()', () => {
    it('[OK] un élève peut lister ses propres chapitres, sans appel réseau (self)', async () => {
      mockChapterRepo.find.mockResolvedValue([buildSampleChapter()]);

      const result = await memoService.findChapters(STUDENT_ID, STUDENT_ID, 'eleve');

      expect(mockChapterRepo.find).toHaveBeenCalledWith({
        where: { studentId: STUDENT_ID },
        relations: ['items'],
        order: { order: 'ASC', createdAt: 'ASC' },
      });
      expect(relationsClient.getRelation).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] un tiers non lié → 403 ForbiddenException', async () => {
      await expect(
        memoService.findChapters(STUDENT_ID, 'parent-uuid', 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // findOneChapter() — lecture tiers relié (B3/B5)
  // ─────────────────────────────────────────────────────────────────────

  describe('findOneChapter()', () => {
    it('[OK] le titulaire élève lit son chapitre', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter({ items: [buildSampleItem()] }));

      const result = await memoService.findOneChapter(CHAPTER_ID, STUDENT_ID, 'eleve');

      expect(result.id).toBe(CHAPTER_ID);
      expect(relationsClient.getRelation).not.toHaveBeenCalled();
    });

    it('[OK] un formateur lié lit le chapitre → 200', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({
        relations: [{ kind: 'teacher_of_student' }],
        isAdministrator: false,
      });

      const result = await memoService.findOneChapter(CHAPTER_ID, TEACHER_ID, 'formateur');

      expect(relationsClient.getRelation).toHaveBeenCalledWith(TEACHER_ID, STUDENT_ID, 'formateur');
      expect(result.id).toBe(CHAPTER_ID);
    });

    it('[OK] un RP coordinateur lié lit le chapitre → 200', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({
        relations: [{ kind: 'coordinator_of_student' }],
        isAdministrator: false,
      });

      await expect(
        memoService.findOneChapter(CHAPTER_ID, 'rp-uuid', 'responsable_pedagogique'),
      ).resolves.toBeDefined();
    });

    it('[OK] un parent financeur lié lit le chapitre → 200', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({
        relations: [{ kind: 'finance_owner_of_student' }],
        isAdministrator: false,
      });

      await expect(
        memoService.findOneChapter(CHAPTER_ID, 'parent-uuid', 'parent_financeur'),
      ).resolves.toBeDefined();
    });

    it('[OK] un administrateur (RP/AF/TI) lit le chapitre sans relation directe → 200', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({ relations: [], isAdministrator: true });

      await expect(
        memoService.findOneChapter(CHAPTER_ID, 'ti-uuid', 'technicien_informatique'),
      ).resolves.toBeDefined();
    });

    it('[CRITIQUE] un formateur non lié → 403 ForbiddenException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({ relations: [], isAdministrator: false });

      await expect(
        memoService.findOneChapter(CHAPTER_ID, 'un-autre-formateur', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] profile-service injoignable → 503, jamais un succès silencieux', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockRejectedValue(
        new ServiceUnavailableException('profile-service is unreachable'),
      );

      await expect(
        memoService.findOneChapter(CHAPTER_ID, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('chapitre introuvable → 404 NotFoundException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(null);

      await expect(
        memoService.findOneChapter('inexistant', STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // updateChapter() / removeChapter()
  // ─────────────────────────────────────────────────────────────────────

  describe('updateChapter()', () => {
    it('[OK] le propriétaire renomme son chapitre', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      const result = await memoService.updateChapter(
        CHAPTER_ID,
        { title: 'Analyse' },
        STUDENT_ID,
        'eleve',
      );

      expect(result.title).toBe('Analyse');
    });

    it('[CRITIQUE] un formateur ne peut pas renommer → 403', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.updateChapter(CHAPTER_ID, { title: 'Hack' }, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('chapitre introuvable → 404', async () => {
      mockChapterRepo.findOne.mockResolvedValue(null);

      await expect(
        memoService.updateChapter('inexistant', { title: 'x' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeChapter()', () => {
    it('[OK] supprime le chapitre et les fichiers image de ses items', async () => {
      const imageItem = buildSampleItem({ type: 'image', imageStoredFilename: 'img-1' });
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter({ items: [imageItem] }));

      await memoService.removeChapter(CHAPTER_ID, STUDENT_ID, 'eleve');

      expect(imageStorage.delete).toHaveBeenCalledWith('img-1');
      expect(mockChapterRepo.remove).toHaveBeenCalled();
    });

    it('[CRITIQUE] un RP ne peut pas supprimer → 403', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.removeChapter(CHAPTER_ID, 'rp-uuid', 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockChapterRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // createItem() — texte / formule
  // ─────────────────────────────────────────────────────────────────────

  describe('createItem()', () => {
    it('[OK] un élève peut ajouter un item de type formula', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      const dto = { type: 'formula' as const, content: '$x^2$', order: 0 };
      const result = await memoService.createItem(CHAPTER_ID, dto, STUDENT_ID, 'eleve');

      expect(result.type).toBe('formula');
    });

    it('[CRITIQUE] un formateur tente d\'ajouter un item → 403 ForbiddenException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.createItem(CHAPTER_ID, { type: 'text' as const, content: 'x' }, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] plafond d\'items atteint → 400 BadRequestException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.count.mockResolvedValue(MEMO_MAX_ITEMS_PER_CHAPTER);

      await expect(
        memoService.createItem(CHAPTER_ID, { type: 'text' as const, content: 'x' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
      expect(mockItemRepo.save).not.toHaveBeenCalled();
    });

    it('chapitre introuvable → 404 NotFoundException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(null);

      await expect(
        memoService.createItem('inexistant', { type: 'text' as const, content: 'x' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // createImageItem()
  // ─────────────────────────────────────────────────────────────────────

  describe('createImageItem()', () => {
    it('[OK] un élève ajoute une image PNG valide', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      const result = await memoService.createImageItem(
        CHAPTER_ID,
        buildImageFile(),
        { caption: 'Formule au tableau' },
        STUDENT_ID,
        'eleve',
      );

      expect(imageStorage.save).toHaveBeenCalled();
      expect(mockItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'image',
          content: 'Formule au tableau',
          imageOriginalFilename: 'formule.png',
          imageStoredFilename: 'stored-image-uuid',
          imageMimeType: 'image/png',
          imageSizeBytes: 1000,
        }),
      );
      expect(result.type).toBe('image');
    });

    it('[CRITIQUE] un formateur tente d\'ajouter une image → 403 ForbiddenException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.createImageItem(CHAPTER_ID, buildImageFile(), {}, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(imageStorage.save).not.toHaveBeenCalled();
    });

    it('aucun fichier envoyé → 400 BadRequestException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.createImageItem(CHAPTER_ID, undefined, {}, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('[CRITIQUE] image dépassant le plafond de taille → 413 structuré', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      const bigFile = buildImageFile({ size: 600_000 });

      await expect(
        memoService.createImageItem(CHAPTER_ID, bigFile, {}, STUDENT_ID, 'eleve'),
      ).rejects.toMatchObject({
        status: 413,
        response: expect.objectContaining({
          code: 'UPLOAD_FILE_TOO_LARGE',
          maxUploadBytes: 500_000,
          receivedBytes: 600_000,
        }),
      });
      expect(imageStorage.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un SVG est explicitement refusé', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue(mimeDetector.SVG_MIME_TYPE);

      await expect(
        memoService.createImageItem(
          CHAPTER_ID,
          buildImageFile({ originalname: 'evil.svg' }),
          {},
          STUDENT_ID,
          'eleve',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(imageStorage.save).not.toHaveBeenCalled();
    });

    it('un format hors liste blanche image (ex: PDF) → 400 BadRequestException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue('application/pdf');

      await expect(
        memoService.createImageItem(CHAPTER_ID, buildImageFile(), {}, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('[CRITIQUE] plafond d\'items atteint → 400, avant tout envoi de fichier au stockage', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.count.mockResolvedValue(MEMO_MAX_ITEMS_PER_CHAPTER);

      await expect(
        memoService.createImageItem(CHAPTER_ID, buildImageFile(), {}, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
      expect(imageStorage.save).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // updateItem() / removeItem() / getImageForDownload()
  // ─────────────────────────────────────────────────────────────────────

  describe('updateItem()', () => {
    it('[OK] le propriétaire modifie le contenu et l\'ordre', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(buildSampleItem());

      const result = await memoService.updateItem(
        CHAPTER_ID,
        ITEM_ID,
        { content: 'nouveau contenu', order: 2 },
        STUDENT_ID,
        'eleve',
      );

      expect(result.content).toBe('nouveau contenu');
      expect(result.order).toBe(2);
    });

    it('[CRITIQUE] un tiers ne peut pas modifier → 403', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.updateItem(CHAPTER_ID, ITEM_ID, { content: 'x' }, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('item introuvable dans ce chapitre → 404', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(null);

      await expect(
        memoService.updateItem(CHAPTER_ID, 'inexistant', { content: 'x' }, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem()', () => {
    it('[OK] supprime un item texte (pas de fichier à nettoyer)', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(buildSampleItem({ type: 'text' }));

      await memoService.removeItem(CHAPTER_ID, ITEM_ID, STUDENT_ID, 'eleve');

      expect(imageStorage.delete).not.toHaveBeenCalled();
      expect(mockItemRepo.remove).toHaveBeenCalled();
    });

    it('[OK] supprime un item image et son fichier associé', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(
        buildSampleItem({ type: 'image', imageStoredFilename: 'img-2' }),
      );

      await memoService.removeItem(CHAPTER_ID, ITEM_ID, STUDENT_ID, 'eleve');

      expect(imageStorage.delete).toHaveBeenCalledWith('img-2');
    });

    it('[CRITIQUE] un tiers ne peut pas supprimer → 403', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());

      await expect(
        memoService.removeItem(CHAPTER_ID, ITEM_ID, 'parent-uuid', 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockItemRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('getImageForDownload()', () => {
    it('[OK] le titulaire télécharge son image', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(
        buildSampleItem({ type: 'image', imageStoredFilename: 'img-3' }),
      );

      const result = await memoService.getImageForDownload(CHAPTER_ID, ITEM_ID, STUDENT_ID, 'eleve');

      expect(imageStorage.read).toHaveBeenCalledWith('img-3');
      expect(result.buffer).toEqual(Buffer.from('image bytes'));
    });

    it('[OK] un formateur lié télécharge l\'image → 200', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(
        buildSampleItem({ type: 'image', imageStoredFilename: 'img-4' }),
      );
      relationsClient.getRelation.mockResolvedValue({
        relations: [{ kind: 'teacher_of_student' }],
        isAdministrator: false,
      });

      await expect(
        memoService.getImageForDownload(CHAPTER_ID, ITEM_ID, TEACHER_ID, 'formateur'),
      ).resolves.toBeDefined();
    });

    it('[CRITIQUE] un formateur non lié → 403, jamais de confiance sur le seul itemId', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      relationsClient.getRelation.mockResolvedValue({ relations: [], isAdministrator: false });

      await expect(
        memoService.getImageForDownload(CHAPTER_ID, ITEM_ID, 'un-autre-formateur', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockItemRepo.findOne).not.toHaveBeenCalled();
    });

    it('item n\'est pas une image → 404', async () => {
      mockChapterRepo.findOne.mockResolvedValue(buildSampleChapter());
      mockItemRepo.findOne.mockResolvedValue(buildSampleItem({ type: 'text' }));

      await expect(
        memoService.getImageForDownload(CHAPTER_ID, ITEM_ID, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // search() / findByStudentForReader() (B6)
  // ─────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('[OK] un élève peut rechercher dans son mémo', async () => {
      mockChapterRepo.find.mockResolvedValue([buildSampleChapter()]);
      mockItemRepo.find.mockResolvedValue([buildSampleItem({ content: 'dérivée' })]);

      const result = await memoService.search(STUDENT_ID, 'dérivée', STUDENT_ID, 'eleve');

      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] un tiers non lié → 403', async () => {
      await expect(
        memoService.search(STUDENT_ID, 'dérivée', 'formateur-uuid', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('requête de recherche vide → 400 BadRequestException', async () => {
      await expect(memoService.search(STUDENT_ID, '', STUDENT_ID, 'eleve')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('aucun chapitre → tableau vide', async () => {
      mockChapterRepo.find.mockResolvedValue([]);

      const result = await memoService.search(STUDENT_ID, 'dérivée', STUDENT_ID, 'eleve');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByStudentForReader() — GET /memos/students/:studentId (B6)', () => {
    it('[OK] un parent financeur lié lit le mémo consolidé', async () => {
      mockChapterRepo.find.mockResolvedValue([buildSampleChapter()]);
      relationsClient.getRelation.mockResolvedValue({
        relations: [{ kind: 'finance_owner_of_student' }],
        isAdministrator: false,
      });

      const result = await memoService.findByStudentForReader(STUDENT_ID, 'parent-uuid', 'parent_financeur');

      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] un parent non lié → 403', async () => {
      await expect(
        memoService.findByStudentForReader(STUDENT_ID, 'un-autre-parent', 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockChapterRepo.find).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] profile-service injoignable → 503', async () => {
      relationsClient.getRelation.mockRejectedValue(
        new ServiceUnavailableException('profile-service is unreachable'),
      );

      await expect(
        memoService.findByStudentForReader(STUDENT_ID, TEACHER_ID, 'formateur'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('[OK] le titulaire élève peut aussi appeler cette route sur lui-même', async () => {
      mockChapterRepo.find.mockResolvedValue([buildSampleChapter()]);

      const result = await memoService.findByStudentForReader(STUDENT_ID, STUDENT_ID, 'eleve');

      expect(relationsClient.getRelation).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
