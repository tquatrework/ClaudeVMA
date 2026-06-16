/**
 * Unit tests — MemoService (refactorisé)
 *
 * Le mémo est un outil EXCLUSIVEMENT élève de formules/trucs essentiels.
 * CRITIQUE XML spec: seul l'élève peut écrire dans son mémo → 403 pour tout autre rôle.
 *
 * Couvre :
 *   - createChapter() : élève peut créer, formateur/RP → 403
 *   - findChapters()  : élève voit ses chapitres, autre élève → 403
 *   - createItem()    : élève peut ajouter, image trop grande → 400, formateur → 403
 *   - search()        : élève peut chercher, autre rôle → 403
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MemoService } from '../../../src/memo/memo.service';
import { MemoChapter } from '../../../src/memo/entities/memo-chapter.entity';
import { MemoItem } from '../../../src/memo/entities/memo-item.entity';

const STUDENT_ID    = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_STUDENT = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const CHAPTER_ID    = 'cccccccc-0000-4000-c000-cccccccccccc';
const ITEM_ID       = 'dddddddd-0000-4000-d000-dddddddddddd';

function buildMockChapterRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
}

function buildMockItemRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
}

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
  };
}

function buildSampleItem(overrides: Partial<MemoItem> = {}): MemoItem {
  return {
    id: ITEM_ID,
    chapterId: CHAPTER_ID,
    chapter: undefined as any,
    type: 'formula',
    content: '$\\frac{a}{b}$',
    sizeKb: null,
    order: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('MemoService', () => {
  let memoService: MemoService;
  let mockChapterRepo: ReturnType<typeof buildMockChapterRepository>;
  let mockItemRepo: ReturnType<typeof buildMockItemRepository>;

  beforeEach(async () => {
    mockChapterRepo = buildMockChapterRepository();
    mockItemRepo = buildMockItemRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MemoService,
        {
          provide: getRepositoryToken(MemoChapter),
          useValue: mockChapterRepo,
        },
        {
          provide: getRepositoryToken(MemoItem),
          useValue: mockItemRepo,
        },
      ],
    }).compile();

    memoService = moduleRef.get<MemoService>(MemoService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // createChapter()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createChapter()', () => {
    it('[OK] un élève peut créer un chapitre dans son propre mémo → 201', async () => {
      const dto = { title: 'Algèbre', order: 0 };
      const savedChapter = buildSampleChapter();

      mockChapterRepo.create.mockReturnValue(savedChapter);
      mockChapterRepo.save.mockResolvedValue(savedChapter);

      const result = await memoService.createChapter(STUDENT_ID, dto, STUDENT_ID, 'eleve');

      expect(mockChapterRepo.create).toHaveBeenCalledWith({
        studentId: STUDENT_ID,
        title: 'Algèbre',
        order: 0,
      });
      expect(result.studentId).toBe(STUDENT_ID);
    });

    it('[CRITIQUE] un formateur tente d\'écrire dans le mémo → 403 ForbiddenException', async () => {
      const dto = { title: 'Mes notes', order: 0 };

      await expect(
        memoService.createChapter(STUDENT_ID, dto, 'formateur-uuid', 'formateur'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockChapterRepo.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un RP tente d\'écrire dans le mémo → 403 ForbiddenException', async () => {
      const dto = { title: 'Notes RP', order: 0 };

      await expect(
        memoService.createChapter(STUDENT_ID, dto, 'rp-uuid', 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] un AP tente d\'écrire dans le mémo → 403 ForbiddenException', async () => {
      const dto = { title: 'Notes AP', order: 0 };

      await expect(
        memoService.createChapter(STUDENT_ID, dto, 'ap-uuid', 'animateur_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un élève tente de modifier le mémo d\'un autre élève → 403 ForbiddenException', async () => {
      const dto = { title: 'Chapitre volé', order: 0 };

      await expect(
        memoService.createChapter(STUDENT_ID, dto, OTHER_STUDENT, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findChapters()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findChapters()', () => {
    it('[OK] un élève peut lister ses propres chapitres', async () => {
      const chapters = [buildSampleChapter()];
      mockChapterRepo.find.mockResolvedValue(chapters);

      const result = await memoService.findChapters(STUDENT_ID, STUDENT_ID, 'eleve');

      expect(mockChapterRepo.find).toHaveBeenCalledWith({
        where: { studentId: STUDENT_ID },
        relations: ['items'],
        order: { order: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] un parent tente de lire le mémo → 403 ForbiddenException', async () => {
      await expect(
        memoService.findChapters(STUDENT_ID, 'parent-uuid', 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] un formateur tente de lire le mémo → 403 ForbiddenException', async () => {
      await expect(
        memoService.findChapters(STUDENT_ID, 'formateur-uuid', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createItem()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createItem()', () => {
    it('[OK] un élève peut ajouter un item de type formula', async () => {
      const sampleChapter = buildSampleChapter();
      const savedItem = buildSampleItem();

      mockChapterRepo.findOne.mockResolvedValue(sampleChapter);
      mockItemRepo.create.mockReturnValue(savedItem);
      mockItemRepo.save.mockResolvedValue(savedItem);

      const dto = { type: 'formula' as const, content: '$x^2$', order: 0 };
      const result = await memoService.createItem(CHAPTER_ID, dto, STUDENT_ID, 'eleve');

      expect(result.type).toBe('formula');
    });

    it('[CRITIQUE] un formateur tente d\'ajouter un item → 403 ForbiddenException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepo.findOne.mockResolvedValue(sampleChapter);

      const dto = { type: 'text' as const, content: 'Note formateur', order: 0 };

      await expect(
        memoService.createItem(CHAPTER_ID, dto, 'formateur-uuid', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] image dépassant 500 Ko → 400 BadRequestException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepo.findOne.mockResolvedValue(sampleChapter);

      const dto = { type: 'image' as const, content: 'data:image/png;base64,...', sizeKb: 501 };

      await expect(
        memoService.createItem(CHAPTER_ID, dto, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('image exactement à 500 Ko → OK', async () => {
      const sampleChapter = buildSampleChapter();
      const savedItem = buildSampleItem({ type: 'image', sizeKb: 500 });

      mockChapterRepo.findOne.mockResolvedValue(sampleChapter);
      mockItemRepo.create.mockReturnValue(savedItem);
      mockItemRepo.save.mockResolvedValue(savedItem);

      const dto = { type: 'image' as const, content: 'data:image/png;base64,...', sizeKb: 500 };

      await expect(
        memoService.createItem(CHAPTER_ID, dto, STUDENT_ID, 'eleve'),
      ).resolves.toBeDefined();
    });

    it('chapitre introuvable → 404 NotFoundException', async () => {
      mockChapterRepo.findOne.mockResolvedValue(null);

      const dto = { type: 'text' as const, content: 'test', order: 0 };

      await expect(
        memoService.createItem('inexistant-uuid', dto, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // search()
  // ─────────────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('[OK] un élève peut rechercher dans son mémo', async () => {
      const chapters = [buildSampleChapter()];
      const items = [buildSampleItem({ content: 'dérivée' })];

      mockChapterRepo.find.mockResolvedValue(chapters);
      mockItemRepo.find.mockResolvedValue(items);

      const result = await memoService.search(STUDENT_ID, 'dérivée', STUDENT_ID, 'eleve');

      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] un formateur tente de chercher dans le mémo → 403 ForbiddenException', async () => {
      await expect(
        memoService.search(STUDENT_ID, 'dérivée', 'formateur-uuid', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('requête de recherche vide → 400 BadRequestException', async () => {
      await expect(
        memoService.search(STUDENT_ID, '', STUDENT_ID, 'eleve'),
      ).rejects.toThrow(BadRequestException);
    });

    it('aucun chapitre → tableau vide', async () => {
      mockChapterRepo.find.mockResolvedValue([]);

      const result = await memoService.search(STUDENT_ID, 'dérivée', STUDENT_ID, 'eleve');

      expect(result).toHaveLength(0);
    });
  });
});
