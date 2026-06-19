/**
 * Unit tests — ChapterService
 *
 * Les chapitres sont des étiquettes de classement optionnelles des mémos élève (PLOG-BR-003).
 * Seul l'élève propriétaire peut créer, renommer et supprimer ses chapitres.
 * Les formateurs, RP et AP peuvent lire un chapitre en lecture seule.
 *
 * Couvre :
 *   - findByStudent()   → filtre par studentId
 *   - create()          → sauvegarde le chapitre avec studentId
 *   - findOne()         → accès autorisé (propriétaire, formateur, RP, AP) et refusé (parent, autre élève)
 *   - update()          → renommage autorisé (élève propriétaire) et refusé (formateur, autre élève)
 *   - remove()          → suppression autorisée (élève propriétaire) et refusée (formateur, RP, autre élève)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChapterService } from '../../../src/memo/chapter.service';
import { Chapter } from '../../../src/memo/entities/chapter.entity';
import { Memo } from '../../../src/memo/entities/memo.entity';

function buildMockChapterRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
}

function buildMockMemoRepository() {
  return {
    find: jest.fn(),
  };
}

const STUDENT_ID       = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_STUDENT_ID = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID     = 'cccccccc-0000-4000-c000-cccccccccccc';
const CHAPTER_ID       = 'dddddddd-0000-4000-d000-dddddddddddd';
const MEMO_ID          = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';

function buildSampleChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id:        CHAPTER_ID,
    studentId: STUDENT_ID,
    title:     'Algèbre',
    memos:     [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Chapter;
}

function buildSampleMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id:         MEMO_ID,
    studentId:  STUDENT_ID,
    content:    'Formule du second degré',
    title:      null,
    activityId: null,
    chapterId:  CHAPTER_ID,
    chapter:    null,
    createdAt:  new Date('2026-01-01T00:00:00Z'),
    updatedAt:  new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Memo;
}

describe('ChapterService', () => {
  let chapterService: ChapterService;
  let mockChapterRepository: ReturnType<typeof buildMockChapterRepository>;
  let mockMemoRepository: ReturnType<typeof buildMockMemoRepository>;

  beforeEach(async () => {
    mockChapterRepository = buildMockChapterRepository();
    mockMemoRepository    = buildMockMemoRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterService,
        {
          provide: getRepositoryToken(Chapter),
          useValue: mockChapterRepository,
        },
        {
          provide: getRepositoryToken(Memo),
          useValue: mockMemoRepository,
        },
      ],
    }).compile();

    chapterService = moduleRef.get<ChapterService>(ChapterService);
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // findByStudent()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findByStudent()', () => {
    it('retourne les chapitres de l\'élève triés par createdAt ASC', async () => {
      const chapterList = [buildSampleChapter(), buildSampleChapter({ id: 'ffff-0000-4000-f000-ffffffffffff' })];
      mockChapterRepository.find.mockResolvedValue(chapterList);

      const result = await chapterService.findByStudent(STUDENT_ID);

      expect(mockChapterRepository.find).toHaveBeenCalledWith({
        where: { studentId: STUDENT_ID },
        order: { createdAt: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('retourne un tableau vide si l\'élève n\'a aucun chapitre', async () => {
      mockChapterRepository.find.mockResolvedValue([]);

      const result = await chapterService.findByStudent(OTHER_STUDENT_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée et sauvegarde un chapitre avec le studentId de l\'élève connecté', async () => {
      const dto = { title: 'Algèbre' };
      const savedChapter = buildSampleChapter({ title: dto.title });

      mockChapterRepository.create.mockReturnValue(savedChapter);
      mockChapterRepository.save.mockResolvedValue(savedChapter);

      const result = await chapterService.create(dto, STUDENT_ID);

      expect(mockChapterRepository.create).toHaveBeenCalledWith({ ...dto, studentId: STUDENT_ID });
      expect(mockChapterRepository.save).toHaveBeenCalledWith(savedChapter);
      expect(result.studentId).toBe(STUDENT_ID);
      expect(result.title).toBe('Algèbre');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne le chapitre avec ses mémos si l\'appelant est l\'élève propriétaire', async () => {
      const sampleChapter = buildSampleChapter();
      const memoList = [buildSampleMemo()];

      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockMemoRepository.find.mockResolvedValue(memoList);

      const result = await chapterService.findOne(CHAPTER_ID, STUDENT_ID, 'eleve');

      expect(result.id).toBe(CHAPTER_ID);
      expect(result.memos).toHaveLength(1);
      expect(result.memos[0].id).toBe(MEMO_ID);
    });

    it('retourne le chapitre si l\'appelant est un formateur (lecture seule)', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockMemoRepository.find.mockResolvedValue([]);

      const result = await chapterService.findOne(CHAPTER_ID, FORMATEUR_ID, 'formateur');

      expect(result.id).toBe(CHAPTER_ID);
    });

    it('retourne le chapitre si l\'appelant est responsable_pedagogique (lecture seule)', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockMemoRepository.find.mockResolvedValue([]);

      const result = await chapterService.findOne(CHAPTER_ID, FORMATEUR_ID, 'responsable_pedagogique');

      expect(result.id).toBe(CHAPTER_ID);
    });

    it('retourne le chapitre si l\'appelant est animateur_pedagogique (lecture seule)', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockMemoRepository.find.mockResolvedValue([]);

      const result = await chapterService.findOne(CHAPTER_ID, FORMATEUR_ID, 'animateur_pedagogique');

      expect(result.id).toBe(CHAPTER_ID);
    });

    it('[PLOG-BR-003] lève ForbiddenException si l\'appelant est un autre élève (non propriétaire)', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.findOne(CHAPTER_ID, OTHER_STUDENT_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] lève ForbiddenException si l\'appelant est parent_financeur', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.findOne(CHAPTER_ID, FORMATEUR_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le chapitre n\'existe pas', async () => {
      mockChapterRepository.findOne.mockResolvedValue(null);

      await expect(
        chapterService.findOne(CHAPTER_ID, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('[PLOG-BR-003] l\'élève propriétaire peut renommer son chapitre', async () => {
      const sampleChapter = buildSampleChapter();
      const renamedChapter = buildSampleChapter({ title: 'Géométrie' });

      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockChapterRepository.save.mockResolvedValue(renamedChapter);

      const result = await chapterService.update(CHAPTER_ID, { title: 'Géométrie' }, STUDENT_ID);

      expect(result.title).toBe('Géométrie');
    });

    it('[PLOG-BR-003] un formateur ne peut pas renommer le chapitre → ForbiddenException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.update(CHAPTER_ID, { title: 'Tentative formateur' }, FORMATEUR_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] un autre élève ne peut pas renommer → ForbiddenException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.update(CHAPTER_ID, { title: 'Intrusion' }, OTHER_STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le chapitre n\'existe pas', async () => {
      mockChapterRepository.findOne.mockResolvedValue(null);

      await expect(
        chapterService.update(CHAPTER_ID, { title: 'x' }, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // remove()
  // ──────────────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('[PLOG-BR-003] l\'élève propriétaire peut supprimer son chapitre', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);
      mockChapterRepository.remove.mockResolvedValue(undefined);

      await expect(
        chapterService.remove(CHAPTER_ID, STUDENT_ID),
      ).resolves.toBeUndefined();

      expect(mockChapterRepository.remove).toHaveBeenCalledWith(sampleChapter);
    });

    it('[PLOG-BR-003] un formateur ne peut pas supprimer un chapitre → ForbiddenException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.remove(CHAPTER_ID, FORMATEUR_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] un autre élève ne peut pas supprimer → ForbiddenException', async () => {
      const sampleChapter = buildSampleChapter();
      mockChapterRepository.findOne.mockResolvedValue(sampleChapter);

      await expect(
        chapterService.remove(CHAPTER_ID, OTHER_STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le chapitre n\'existe pas', async () => {
      mockChapterRepository.findOne.mockResolvedValue(null);

      await expect(
        chapterService.remove(CHAPTER_ID, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
