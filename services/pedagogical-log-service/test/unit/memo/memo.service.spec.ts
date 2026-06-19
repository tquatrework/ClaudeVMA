/**
 * Unit tests — MemoService
 *
 * Le mémo est un formulaire structuré appartenant à l'élève (PLOG-BR-003).
 * Il N'EST PAS une note interne du personnel.
 *
 * Couvre :
 *   - create()         → sauvegarde le mémo avec studentId (l'élève est propriétaire)
 *   - findByStudent()  → filtre par studentId
 *   - findOne()        → accès autorisé (propriétaire élève, formateur, RP, AP) et refusé (autre élève, parent, TI)
 *   - update()         → modification autorisée (élève propriétaire) et refusée (formateur, RP, autre élève)
 *   - remove()         → suppression autorisée (élève propriétaire) et refusée (formateur, RP)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemoService } from '../../../src/memo/memo.service';
import { Memo } from '../../../src/memo/entities/memo.entity';

/** Minimal mock for a TypeORM Repository<Memo> */
function buildMockRepository() {
  return {
    create: jest.fn(),
    save:   jest.fn(),
    find:   jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
}

const STUDENT_ID       = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_STUDENT_ID = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const FORMATEUR_ID     = 'cccccccc-0000-4000-c000-cccccccccccc';
const MEMO_ID          = 'dddddddd-0000-4000-d000-dddddddddddd';

function buildSampleMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id:         MEMO_ID,
    studentId:  STUDENT_ID,
    content:    'Contenu du mémo test',
    title:      null,
    activityId: null,
    createdAt:  new Date('2026-01-01T00:00:00Z'),
    updatedAt:  new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('MemoService', () => {
  let memoService: MemoService;
  let mockRepository: ReturnType<typeof buildMockRepository>;

  beforeEach(async () => {
    mockRepository = buildMockRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MemoService,
        {
          provide: getRepositoryToken(Memo),
          useValue: mockRepository,
        },
      ],
    }).compile();

    memoService = moduleRef.get<MemoService>(MemoService);
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('crée et sauvegarde un mémo avec studentId (l\'élève est propriétaire)', async () => {
      const dto = { content: 'Formule du second degré', title: 'Rappel algèbre', activityId: undefined };
      const savedMemo = buildSampleMemo({ content: dto.content, title: dto.title });

      mockRepository.create.mockReturnValue(savedMemo);
      mockRepository.save.mockResolvedValue(savedMemo);

      const result = await memoService.create(dto, STUDENT_ID);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        studentId: STUDENT_ID,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(savedMemo);
      expect(result.studentId).toBe(STUDENT_ID);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findByStudent()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findByStudent()', () => {
    it('retourne uniquement les mémos de l\'élève demandé', async () => {
      const memoList = [buildSampleMemo(), buildSampleMemo({ id: 'eeee-0000-4000-e000-eeeeeeeeeeee' })];
      mockRepository.find.mockResolvedValue(memoList);

      const result = await memoService.findByStudent(STUDENT_ID);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { studentId: STUDENT_ID },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('retourne un tableau vide si aucun mémo pour cet élève', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await memoService.findByStudent(OTHER_STUDENT_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne le mémo si l\'appelant est l\'élève propriétaire', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, STUDENT_ID, 'eleve');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est un formateur (lecture seule)', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, FORMATEUR_ID, 'formateur');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est responsable_pedagogique (lecture seule)', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, FORMATEUR_ID, 'responsable_pedagogique');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est animateur_pedagogique (lecture seule)', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, FORMATEUR_ID, 'animateur_pedagogique');

      expect(result.id).toBe(MEMO_ID);
    });

    it('[PLOG-BR-003] lève ForbiddenException si l\'appelant est un autre élève (non propriétaire)', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.findOne(MEMO_ID, OTHER_STUDENT_ID, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] lève ForbiddenException si l\'appelant est parent_financeur', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.findOne(MEMO_ID, FORMATEUR_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le mémo n\'existe pas', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        memoService.findOne(MEMO_ID, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('[PLOG-BR-003] l\'élève propriétaire peut modifier son mémo', async () => {
      const sampleMemo = buildSampleMemo();
      const updatedMemo = buildSampleMemo({ content: 'Contenu modifié' });

      mockRepository.findOne.mockResolvedValue(sampleMemo);
      mockRepository.save.mockResolvedValue(updatedMemo);

      const result = await memoService.update(MEMO_ID, { content: 'Contenu modifié' }, STUDENT_ID);

      expect(result.content).toBe('Contenu modifié');
    });

    it('[PLOG-BR-003] un formateur ne peut pas modifier le mémo d\'un élève → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.update(MEMO_ID, { content: 'Tentative formateur' }, FORMATEUR_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] un autre élève ne peut pas modifier → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.update(MEMO_ID, { content: 'Intrusion' }, OTHER_STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le mémo n\'existe pas', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        memoService.update(MEMO_ID, { content: 'x' }, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // remove()
  // ──────────────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('[PLOG-BR-003] l\'élève propriétaire peut supprimer son mémo', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        memoService.remove(MEMO_ID, STUDENT_ID),
      ).resolves.toBeUndefined();

      expect(mockRepository.remove).toHaveBeenCalledWith(sampleMemo);
    });

    it('[PLOG-BR-003] un formateur ne peut pas supprimer le mémo d\'un élève → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.remove(MEMO_ID, FORMATEUR_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[PLOG-BR-003] un autre élève ne peut pas supprimer → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.remove(MEMO_ID, OTHER_STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le mémo n\'existe pas', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        memoService.remove(MEMO_ID, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
