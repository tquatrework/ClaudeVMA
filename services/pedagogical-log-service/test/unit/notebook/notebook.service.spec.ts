/**
 * Unit tests — NotebookService
 *
 * Cas critiques obligatoires (XML spec):
 *   - Parent tente de lire le carnet personnel → 403
 *   - RP tente de lire le carnet personnel → 403 (arbitrage Phase 1 conservateur)
 *   - Élève crée une entrée → 201
 *   - Un autre élève tente de lire → 403
 *
 * Couvre :
 *   - create()   : propriétaire uniquement
 *   - findAll()  : élève uniquement (RP → 403 en Phase 1, parent → 403)
 *   - findOne()  : élève ou TI uniquement
 *   - update()   : propriétaire uniquement
 *   - remove()   : propriétaire uniquement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotebookService } from '../../../src/notebook/notebook.service';
import { NotebookEntry } from '../../../src/notebook/entities/notebook-entry.entity';

const STUDENT_ID    = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const OTHER_STUDENT = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const ENTRY_ID      = 'cccccccc-0000-4000-c000-cccccccccccc';
const PARENT_ID     = 'dddddddd-0000-4000-d000-dddddddddddd';
const RP_ID         = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';
const TI_ID         = 'ffffffff-0000-4000-f000-ffffffffffff';

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
}

function buildSampleEntry(overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return {
    id: ENTRY_ID,
    studentId: STUDENT_ID,
    content: 'Mon entrée personnelle',
    title: 'Titre',
    entryDate: new Date('2026-06-16'),
    calendarEventId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('NotebookService', () => {
  let notebookService: NotebookService;
  let mockRepository: ReturnType<typeof buildMockRepository>;

  beforeEach(async () => {
    mockRepository = buildMockRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotebookService,
        {
          provide: getRepositoryToken(NotebookEntry),
          useValue: mockRepository,
        },
      ],
    }).compile();

    notebookService = moduleRef.get<NotebookService>(NotebookService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // create()
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('[OK] un élève peut créer une entrée dans son carnet → 201', async () => {
      const dto = { content: 'Mon entrée', title: 'Titre', entryDate: '2026-06-16' };
      const savedEntry = buildSampleEntry();

      mockRepository.create.mockReturnValue(savedEntry);
      mockRepository.save.mockResolvedValue(savedEntry);

      const result = await notebookService.create(STUDENT_ID, dto, STUDENT_ID);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: STUDENT_ID }),
      );
      expect(result.studentId).toBe(STUDENT_ID);
    });

    it('un autre élève tente d\'écrire dans le carnet → ForbiddenException', async () => {
      const dto = { content: 'Intrusion', title: null };

      await expect(
        notebookService.create(STUDENT_ID, dto, OTHER_STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('[OK] l\'élève peut lire son propre carnet', async () => {
      const entries = [buildSampleEntry()];
      mockRepository.find.mockResolvedValue(entries);

      const result = await notebookService.findAll(STUDENT_ID, STUDENT_ID, 'eleve');

      expect(result).toHaveLength(1);
    });

    it('[CRITIQUE] le parent ne peut pas accéder au carnet personnel → ForbiddenException', async () => {
      await expect(
        notebookService.findAll(STUDENT_ID, PARENT_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[CRITIQUE] le RP ne peut pas accéder au carnet personnel (arbitrage Phase 1 conservateur) → ForbiddenException', async () => {
      // En Phase 1, décision conservatrice: RP n'a pas accès au carnet personnel.
      // La route /students/:studentId/notebook n'autorise que ELEVE et TI.
      // NotebookService.findAll lève ForbiddenException si rôle != eleve et != technicien_informatique.
      await expect(
        notebookService.findAll(STUDENT_ID, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('le TI peut lire pour incident technique', async () => {
      const entries = [buildSampleEntry()];
      mockRepository.find.mockResolvedValue(entries);

      const result = await notebookService.findAll(STUDENT_ID, TI_ID, 'technicien_informatique');

      expect(result).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('[OK] l\'élève lit sa propre entrée', async () => {
      const entry = buildSampleEntry();
      mockRepository.findOne.mockResolvedValue(entry);

      const result = await notebookService.findOne(STUDENT_ID, ENTRY_ID, STUDENT_ID, 'eleve');

      expect(result.id).toBe(ENTRY_ID);
    });

    it('[CRITIQUE] un parent tente de lire une entrée → ForbiddenException', async () => {
      const entry = buildSampleEntry();
      mockRepository.findOne.mockResolvedValue(entry);

      await expect(
        notebookService.findOne(STUDENT_ID, ENTRY_ID, PARENT_ID, 'parent_financeur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('entrée introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        notebookService.findOne(STUDENT_ID, ENTRY_ID, STUDENT_ID, 'eleve'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update() + remove()
  // ─────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('[OK] l\'élève peut modifier sa propre entrée', async () => {
      const entry = buildSampleEntry();
      const updatedEntry = buildSampleEntry({ content: 'Modifié' });

      mockRepository.findOne.mockResolvedValue(entry);
      mockRepository.save.mockResolvedValue(updatedEntry);

      const result = await notebookService.update(STUDENT_ID, ENTRY_ID, { content: 'Modifié' }, STUDENT_ID);

      expect(result.content).toBe('Modifié');
    });

    it('un autre élève ne peut pas modifier → ForbiddenException', async () => {
      await expect(
        notebookService.update(STUDENT_ID, ENTRY_ID, { content: 'hack' }, OTHER_STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove()', () => {
    it('[OK] l\'élève peut supprimer sa propre entrée', async () => {
      const entry = buildSampleEntry();
      mockRepository.findOne.mockResolvedValue(entry);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        notebookService.remove(STUDENT_ID, ENTRY_ID, STUDENT_ID),
      ).resolves.toBeUndefined();
    });

    it('un autre élève ne peut pas supprimer → ForbiddenException', async () => {
      await expect(
        notebookService.remove(STUDENT_ID, ENTRY_ID, OTHER_STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
