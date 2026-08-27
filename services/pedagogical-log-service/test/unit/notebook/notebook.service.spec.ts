/**
 * Unit tests — NotebookService
 *
 * Généralisé le 2026-08-27 (docs/architecture.md, "Generalisation du carnet
 * personnel a d'autres roles que l'eleve") : le carnet personnel n'est plus
 * réservé au rôle élève. Chaque utilisateur authentifié — quel que soit son
 * rôle — a son propre carnet, strictement privé (`ownerId = callerId`).
 * Aucune exception, y compris pour les rôles administratifs (RP, AF, TI) :
 * l'ancien accès spécial TI "incident" est retiré par cette même session.
 *
 * Cas critiques obligatoires :
 *   - Un utilisateur de N'IMPORTE QUEL rôle crée/lit/modifie/supprime son
 *     propre carnet → succès, quel que soit le rôle.
 *   - Un autre utilisateur (même rôle ou rôle différent, y compris
 *     administratif : RP, TI, AF) tente de lire/écrire le carnet d'autrui
 *     → 403, sans aucune exception.
 *
 * Couvre : create(), findAll(), findOne(), update(), remove().
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotebookService } from '../../../src/notebook/notebook.service';
import { NotebookEntry } from '../../../src/notebook/entities/notebook-entry.entity';

const STUDENT_ID  = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const TEACHER_ID  = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const AP_ID       = 'cccccccc-0000-4000-c000-cccccccccccc';
const ENTRY_ID    = 'dddddddd-0000-4000-d000-dddddddddddd';
const RP_ID       = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';
const TI_ID       = 'ffffffff-0000-4000-f000-ffffffffffff';
const AF_ID       = '11111111-0000-4000-a000-111111111111';
const PARENT_ID   = '22222222-0000-4000-a000-222222222222';

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
    ownerId: STUDENT_ID,
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
  // create() — cas nominal par rôle : n'importe quel rôle crée dans SON carnet
  // ─────────────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it.each([
      ['élève', STUDENT_ID],
      ['formateur', TEACHER_ID],
      ['animateur pédagogique', AP_ID],
      ['responsable pédagogique', RP_ID],
      ['technicien informatique', TI_ID],
      ['administrateur financier', AF_ID],
      ['parent financeur', PARENT_ID],
    ])('[OK] un utilisateur (%s) crée une entrée dans son propre carnet → 201', async (_label, callerId) => {
      const dto = { content: 'Mon entrée', title: 'Titre', entryDate: '2026-06-16' };
      const savedEntry = buildSampleEntry({ ownerId: callerId });

      mockRepository.create.mockReturnValue(savedEntry);
      mockRepository.save.mockResolvedValue(savedEntry);

      const result = await notebookService.create(dto, callerId);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: callerId }),
      );
      expect(result.ownerId).toBe(callerId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAll() — chacun ne voit que son propre carnet, aucune exception
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it.each([
      ['élève', STUDENT_ID],
      ['formateur', TEACHER_ID],
      ['animateur pédagogique', AP_ID],
    ])('[OK] un utilisateur (%s) lit son propre carnet', async (_label, callerId) => {
      const entries = [buildSampleEntry({ ownerId: callerId })];
      mockRepository.find.mockResolvedValue(entries);

      const result = await notebookService.findAll(callerId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: callerId } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findOne() — [CRITIQUE] personne d'autre que le titulaire n'accède, y
  // compris les rôles administratifs (aucune exception TI/RP/AF)
  // ─────────────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('[OK] le titulaire lit sa propre entrée', async () => {
      const entry = buildSampleEntry({ ownerId: STUDENT_ID });
      mockRepository.findOne.mockResolvedValue(entry);

      const result = await notebookService.findOne(ENTRY_ID, STUDENT_ID);

      expect(result.id).toBe(ENTRY_ID);
    });

    it.each([
      ['un parent financeur', PARENT_ID],
      ['un autre élève', TEACHER_ID],
      ['le responsable pédagogique (RP)', RP_ID],
      ['le technicien informatique (TI) — ancien accès incident retiré', TI_ID],
      ["l'administrateur financier (AF)", AF_ID],
    ])('[CRITIQUE] %s tente de lire le carnet d\'autrui → ForbiddenException', async (_label, callerId) => {
      const entry = buildSampleEntry({ ownerId: STUDENT_ID });
      mockRepository.findOne.mockResolvedValue(entry);

      await expect(
        notebookService.findOne(ENTRY_ID, callerId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('entrée introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        notebookService.findOne(ENTRY_ID, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update() + remove()
  // ─────────────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('[OK] le titulaire (formateur) modifie sa propre entrée', async () => {
      const entry = buildSampleEntry({ ownerId: TEACHER_ID });
      const updatedEntry = buildSampleEntry({ ownerId: TEACHER_ID, content: 'Modifié' });

      mockRepository.findOne.mockResolvedValue(entry);
      mockRepository.save.mockResolvedValue(updatedEntry);

      const result = await notebookService.update(ENTRY_ID, { content: 'Modifié' }, TEACHER_ID);

      expect(result.content).toBe('Modifié');
    });

    it.each([
      ['un autre utilisateur du même rôle', STUDENT_ID],
      ['le RP', RP_ID],
      ['le TI', TI_ID],
    ])('[CRITIQUE] %s ne peut pas modifier le carnet d\'autrui → ForbiddenException', async (_label, callerId) => {
      const entry = buildSampleEntry({ ownerId: TEACHER_ID });
      mockRepository.findOne.mockResolvedValue(entry);

      await expect(
        notebookService.update(ENTRY_ID, { content: 'hack' }, callerId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('entrée introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        notebookService.update(ENTRY_ID, { content: 'x' }, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('[OK] le titulaire (animateur pédagogique) supprime sa propre entrée', async () => {
      const entry = buildSampleEntry({ ownerId: AP_ID });
      mockRepository.findOne.mockResolvedValue(entry);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        notebookService.remove(ENTRY_ID, AP_ID),
      ).resolves.toBeUndefined();
    });

    it.each([
      ['un autre utilisateur', STUDENT_ID],
      ['le TI — ancien accès incident retiré', TI_ID],
    ])('[CRITIQUE] %s ne peut pas supprimer le carnet d\'autrui → ForbiddenException', async (_label, callerId) => {
      const entry = buildSampleEntry({ ownerId: AP_ID });
      mockRepository.findOne.mockResolvedValue(entry);

      await expect(
        notebookService.remove(ENTRY_ID, callerId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('entrée introuvable → NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        notebookService.remove(ENTRY_ID, STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
