/**
 * Unit tests — NotebookService
 *
 * Généralisé le 2026-08-27 (docs/architecture.md, "Generalisation du carnet
 * personnel a d'autres roles que l'eleve") : le carnet personnel n'est plus
 * réservé au rôle élève. Chaque utilisateur authentifié — quel que soit son
 * rôle — a son propre carnet, strictement privé (`ownerId = callerId`).
 * Aucune exception EN ÉCRITURE (création, suppression) ni sur `findOne()`
 * (détail par id), y compris pour les rôles administratifs (RP, AF, TI) :
 * l'ancien accès spécial TI "incident" est retiré par cette même session.
 *
 * Cas critiques obligatoires :
 *   - Un utilisateur de N'IMPORTE QUEL rôle crée/lit/supprime dans son
 *     propre carnet → succès, quel que soit le rôle.
 *   - Un autre utilisateur (même rôle ou rôle différent, y compris
 *     administratif : RP, TI, AF) tente de lire/écrire le carnet d'autrui
 *     → 403, sans aucune exception (`findOne()`/`remove()`).
 *
 * Spécification fonctionnelle réelle — notes rapides immuables (docs/
 * architecture.md, arbitrage du 2026-08-27) : `update()` est retirée (une
 * pensée instantanée ne s'édite pas), `findAll()` accepte désormais un
 * filtre optionnel `from`/`to`/`q`.
 *
 * Accès administratif et parental — arbitrage du 2026-08-28 : couvre
 * `findAllForThirdParty()`, seule route qui ouvre une lecture (jamais une
 * écriture) sur le carnet d'un tiers, contrôlée par
 * `NotebookAccessSettingsService` et, pour l'axe parental,
 * `ProfileRelationsClient`.
 *
 * Couvre : create(), findAll() (avec et sans filtre), findAllForThirdParty(),
 * findOne(), remove().
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { NotebookService } from '../../../src/notebook/notebook.service';
import { NotebookEntry } from '../../../src/notebook/entities/notebook-entry.entity';
import { NotebookAccessSettingsService } from '../../../src/settings/notebook-access-settings.service';
import { NotebookAdminAccess } from '../../../src/settings/entities/notebook-access-settings.entity';
import { ProfileRelationsClient } from '../../../src/common/clients/profile-relations.client';

const STUDENT_ID  = 'aaaaaaaa-0000-4000-a000-aaaaaaaaaaaa';
const TEACHER_ID  = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';
const AP_ID       = 'cccccccc-0000-4000-c000-cccccccccccc';
const ENTRY_ID    = 'dddddddd-0000-4000-d000-dddddddddddd';
const RP_ID       = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';
const TI_ID       = 'ffffffff-0000-4000-f000-ffffffffffff';
const AF_ID       = '11111111-0000-4000-a000-111111111111';
const PARENT_ID   = '22222222-0000-4000-a000-222222222222';
const OTHER_OWNER_ID = '33333333-0000-4000-a000-333333333333';

function buildMockQueryBuilder(entries: NotebookEntry[]) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(entries),
  };
  return qb;
}

function buildMockRepository() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
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

function buildDefaultAccessSettings(overrides: Record<string, any> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    adminAccess: NotebookAdminAccess.NONE,
    parentAccessToOwnChild: false,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('NotebookService', () => {
  let notebookService: NotebookService;
  let mockRepository: ReturnType<typeof buildMockRepository>;
  let accessSettingsService: { getSettings: jest.Mock };
  let relationsClient: { getRelation: jest.Mock };

  beforeEach(async () => {
    mockRepository = buildMockRepository();
    accessSettingsService = {
      getSettings: jest.fn().mockResolvedValue(buildDefaultAccessSettings()),
    };
    relationsClient = {
      getRelation: jest.fn().mockResolvedValue({ relations: [], isAdministrator: false }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotebookService,
        {
          provide: getRepositoryToken(NotebookEntry),
          useValue: mockRepository,
        },
        { provide: NotebookAccessSettingsService, useValue: accessSettingsService },
        { provide: ProfileRelationsClient, useValue: relationsClient },
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
    ])('[OK] un utilisateur (%s) lit son propre carnet, sans filtre', async (_label, callerId) => {
      const entries = [buildSampleEntry({ ownerId: callerId })];
      const qb = buildMockQueryBuilder(entries);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await notebookService.findAll(callerId);

      expect(qb.where).toHaveBeenCalledWith('entry.ownerId = :ownerId', { ownerId: callerId });
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('[OK] filtre par plage de dates (from/to) sur createdAt', async () => {
      const qb = buildMockQueryBuilder([buildSampleEntry({ ownerId: STUDENT_ID })]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await notebookService.findAll(STUDENT_ID, { from: '2026-08-01', to: '2026-08-31' });

      expect(qb.andWhere).toHaveBeenCalledWith('DATE(entry.createdAt) >= :from', { from: '2026-08-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('DATE(entry.createdAt) <= :to', { to: '2026-08-31' });
    });

    it('[OK] une date précise se cherche avec from=to', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await notebookService.findAll(STUDENT_ID, { from: '2026-08-27', to: '2026-08-27' });

      expect(qb.andWhere).toHaveBeenCalledWith('DATE(entry.createdAt) >= :from', { from: '2026-08-27' });
      expect(qb.andWhere).toHaveBeenCalledWith('DATE(entry.createdAt) <= :to', { to: '2026-08-27' });
    });

    it('[OK] recherche texte libre (q) sur content', async () => {
      const qb = buildMockQueryBuilder([buildSampleEntry({ ownerId: STUDENT_ID })]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await notebookService.findAll(STUDENT_ID, { q: 'dérivée' });

      expect(qb.andWhere).toHaveBeenCalledWith('entry.content ILIKE :q', { q: '%dérivée%' });
    });

    it('[OK] filtres combinables (from/to et q en même temps)', async () => {
      const qb = buildMockQueryBuilder([]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await notebookService.findAll(STUDENT_ID, { from: '2026-08-01', to: '2026-08-31', q: 'test' });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findAllForThirdParty() — arbitrage du 2026-08-28 : accès administratif
  // (RP/AF/TI selon adminAccess) et parental (parent financeur selon
  // parentAccessToOwnChild + relation active), lecture seule, contrôlé à
  // chaque appel, jamais en cache.
  // ─────────────────────────────────────────────────────────────────────────

  describe('findAllForThirdParty()', () => {
    it('[OK] le titulaire lisant son propre carnet via cette route est toujours autorisé, sans appel réseau', async () => {
      const qb = buildMockQueryBuilder([buildSampleEntry({ ownerId: STUDENT_ID })]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await notebookService.findAllForThirdParty(
        STUDENT_ID,
        STUDENT_ID,
        'eleve',
      );

      expect(result).toHaveLength(1);
      expect(accessSettingsService.getSettings).not.toHaveBeenCalled();
      expect(relationsClient.getRelation).not.toHaveBeenCalled();
    });

    it.each([
      ['élève', STUDENT_ID, 'eleve'],
      ['formateur', TEACHER_ID, 'formateur'],
      ['animateur pédagogique', AP_ID, 'animateur_pedagogique'],
    ])(
      '[CRITIQUE] %s → 403, structurellement jamais éligible, quel que soit le réglage',
      async (_label, callerId, callerRole) => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ adminAccess: NotebookAdminAccess.ALL_ADMINS, parentAccessToOwnChild: true }),
        );

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, callerId, callerRole),
        ).rejects.toThrow(ForbiddenException);
      },
    );

    describe('axe administratif', () => {
      it('[OK] RP lit le carnet de n\'importe quel titulaire quand adminAccess = "rp"', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ adminAccess: NotebookAdminAccess.RP }),
        );
        const qb = buildMockQueryBuilder([buildSampleEntry({ ownerId: OTHER_OWNER_ID })]);
        mockRepository.createQueryBuilder.mockReturnValue(qb);

        const result = await notebookService.findAllForThirdParty(
          OTHER_OWNER_ID,
          RP_ID,
          'responsable_pedagogique',
        );

        expect(result).toHaveLength(1);
      });

      it('[OK] RP lit aussi quand adminAccess = "all_admins" (RP inclus)', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ adminAccess: NotebookAdminAccess.ALL_ADMINS }),
        );
        mockRepository.createQueryBuilder.mockReturnValue(buildMockQueryBuilder([]));

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, RP_ID, 'responsable_pedagogique'),
        ).resolves.toBeDefined();
      });

      it('[CRITIQUE] RP → 404 quand adminAccess = "none" (défaut)', async () => {
        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, RP_ID, 'responsable_pedagogique'),
        ).rejects.toThrow(NotFoundException);
      });

      it.each([
        ["l'administrateur financier (AF)", AF_ID, 'administrateur_financier'],
        ['le technicien informatique (TI)', TI_ID, 'technicien_informatique'],
      ])(
        '[OK] %s lit n\'importe quel carnet quand adminAccess = "all_admins"',
        async (_label, callerId, callerRole) => {
          accessSettingsService.getSettings.mockResolvedValue(
            buildDefaultAccessSettings({ adminAccess: NotebookAdminAccess.ALL_ADMINS }),
          );
          mockRepository.createQueryBuilder.mockReturnValue(buildMockQueryBuilder([]));

          await expect(
            notebookService.findAllForThirdParty(OTHER_OWNER_ID, callerId, callerRole),
          ).resolves.toBeDefined();
        },
      );

      it.each([
        ["l'administrateur financier (AF)", AF_ID, 'administrateur_financier'],
        ['le technicien informatique (TI)', TI_ID, 'technicien_informatique'],
      ])(
        '[CRITIQUE] %s → 404 quand adminAccess = "rp" (AF/TI pas couverts par "rp" seul)',
        async (_label, callerId, callerRole) => {
          accessSettingsService.getSettings.mockResolvedValue(
            buildDefaultAccessSettings({ adminAccess: NotebookAdminAccess.RP }),
          );

          await expect(
            notebookService.findAllForThirdParty(OTHER_OWNER_ID, callerId, callerRole),
          ).rejects.toThrow(NotFoundException);
        },
      );
    });

    describe('axe parental', () => {
      it('[OK] parent financeur lit le carnet de son enfant quand parentAccessToOwnChild=true et relation active', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ parentAccessToOwnChild: true }),
        );
        relationsClient.getRelation.mockResolvedValue({
          relations: [{ kind: 'finance_owner_of_student' }],
          isAdministrator: false,
        });
        mockRepository.createQueryBuilder.mockReturnValue(buildMockQueryBuilder([]));

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, PARENT_ID, 'parent_financeur'),
        ).resolves.toBeDefined();
        expect(relationsClient.getRelation).toHaveBeenCalledWith(PARENT_ID, OTHER_OWNER_ID, 'parent_financeur');
      });

      it('[CRITIQUE] parent financeur → 404 quand parentAccessToOwnChild=false (défaut), sans appel réseau', async () => {
        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, PARENT_ID, 'parent_financeur'),
        ).rejects.toThrow(NotFoundException);
        expect(relationsClient.getRelation).not.toHaveBeenCalled();
      });

      it('[CRITIQUE] parent financeur → 404 quand parentAccessToOwnChild=true mais relation absente/rompue', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ parentAccessToOwnChild: true }),
        );
        relationsClient.getRelation.mockResolvedValue({ relations: [], isAdministrator: false });

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, PARENT_ID, 'parent_financeur'),
        ).rejects.toThrow(NotFoundException);
      });

      it('[CRITIQUE] profile-service injoignable → 503 (échec fermé)', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ parentAccessToOwnChild: true }),
        );
        relationsClient.getRelation.mockRejectedValue(
          new ServiceUnavailableException('profile-service is unreachable'),
        );

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, PARENT_ID, 'parent_financeur'),
        ).rejects.toThrow(ServiceUnavailableException);
      });

      it('un parent financeur non rattaché à CET élève ne lit pas son carnet (relation ciblée, pas globale)', async () => {
        accessSettingsService.getSettings.mockResolvedValue(
          buildDefaultAccessSettings({ parentAccessToOwnChild: true }),
        );
        // Le parent a un lien actif avec un AUTRE élève, pas OTHER_OWNER_ID.
        relationsClient.getRelation.mockResolvedValue({ relations: [], isAdministrator: false });

        await expect(
          notebookService.findAllForThirdParty(OTHER_OWNER_ID, PARENT_ID, 'parent_financeur'),
        ).rejects.toThrow(NotFoundException);
      });
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
  // remove() — aucune méthode update() : une pensée instantanée ne s'édite
  // pas, elle se supprime et se réécrit si besoin (docs/architecture.md,
  // arbitrage du 2026-08-27, "notes rapides immuables")
  // ─────────────────────────────────────────────────────────────────────────

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
