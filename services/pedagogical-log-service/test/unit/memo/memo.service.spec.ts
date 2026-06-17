/**
 * Unit tests — MemoService
 *
 * Couvre :
 *   - create()          → sauvegarde le mémo avec authorId et authorRole
 *   - findByAuthor()    → filtre par authorId
 *   - findOne()         → accès autorisé (auteur, RP, AP, TI, ADMIN_FIN) et refusé (autre formateur)
 *   - remove()          → suppression autorisée (auteur, RP, TI) et refusée (autre formateur, AP)
 *
 * Régression #FIX-403 : ADMINISTRATEUR_FINANCIER doit pouvoir lire les mémos
 * (ajouté dans findOne après correction du bug GET /memos → 403).
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

const AUTHOR_ID      = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_USER_ID  = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const MEMO_ID        = 'cccccccc-0000-4000-c000-cccccccccccc';

function buildSampleMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id:         MEMO_ID,
    authorId:   AUTHOR_ID,
    authorRole: 'formateur',
    studentId:  null,
    activityId: null,
    content:    'Contenu du mémo test',
    title:      null,
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
    it('crée et sauvegarde un mémo avec authorId et authorRole', async () => {
      const dto = { content: 'Préparer exercice', title: 'Rappel', studentId: undefined, activityId: undefined };
      const savedMemo = buildSampleMemo({ content: dto.content, title: dto.title });

      mockRepository.create.mockReturnValue(savedMemo);
      mockRepository.save.mockResolvedValue(savedMemo);

      const result = await memoService.create(dto, AUTHOR_ID, 'formateur');

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        authorId:   AUTHOR_ID,
        authorRole: 'formateur',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(savedMemo);
      expect(result.authorId).toBe(AUTHOR_ID);
      expect(result.authorRole).toBe('formateur');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findByAuthor()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findByAuthor()', () => {
    it('retourne uniquement les mémos de l\'auteur demandé', async () => {
      const memoList = [buildSampleMemo(), buildSampleMemo({ id: 'dddd-0000-4000-d000-dddddddddddd' })];
      mockRepository.find.mockResolvedValue(memoList);

      const result = await memoService.findByAuthor(AUTHOR_ID);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { authorId: AUTHOR_ID },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('retourne un tableau vide si aucun mémo pour cet auteur', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await memoService.findByAuthor(OTHER_USER_ID);

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retourne le mémo si l\'appelant en est l\'auteur', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, AUTHOR_ID, 'formateur');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est responsable_pedagogique', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, OTHER_USER_ID, 'responsable_pedagogique');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est animateur_pedagogique', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, OTHER_USER_ID, 'animateur_pedagogique');

      expect(result.id).toBe(MEMO_ID);
    });

    it('retourne le mémo si l\'appelant est technicien_informatique', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, OTHER_USER_ID, 'technicien_informatique');

      expect(result.id).toBe(MEMO_ID);
    });

    /**
     * Régression #FIX-403 — ADMINISTRATEUR_FINANCIER doit pouvoir lire les mémos.
     * Bug original : findOne() levait ForbiddenException pour ce rôle.
     */
    it('[#FIX-403] retourne le mémo si l\'appelant est administrateur_financier', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      const result = await memoService.findOne(MEMO_ID, OTHER_USER_ID, 'administrateur_financier');

      expect(result.id).toBe(MEMO_ID);
    });

    it('lève ForbiddenException si l\'appelant est un autre formateur (non auteur)', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.findOne(MEMO_ID, OTHER_USER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le mémo n\'existe pas', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        memoService.findOne(MEMO_ID, AUTHOR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // remove()
  // ──────────────────────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('l\'auteur peut supprimer son mémo', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        memoService.remove(MEMO_ID, AUTHOR_ID, 'formateur'),
      ).resolves.toBeUndefined();

      expect(mockRepository.remove).toHaveBeenCalledWith(sampleMemo);
    });

    it('un RP peut supprimer n\'importe quel mémo', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        memoService.remove(MEMO_ID, OTHER_USER_ID, 'responsable_pedagogique'),
      ).resolves.toBeUndefined();
    });

    it('un TI peut supprimer n\'importe quel mémo', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        memoService.remove(MEMO_ID, OTHER_USER_ID, 'technicien_informatique'),
      ).resolves.toBeUndefined();
    });

    it('un AP ne peut pas supprimer le mémo d\'un autre → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.remove(MEMO_ID, OTHER_USER_ID, 'animateur_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un autre formateur ne peut pas supprimer → ForbiddenException', async () => {
      const sampleMemo = buildSampleMemo();
      mockRepository.findOne.mockResolvedValue(sampleMemo);

      await expect(
        memoService.remove(MEMO_ID, OTHER_USER_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le mémo n\'existe pas', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        memoService.remove(MEMO_ID, AUTHOR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
