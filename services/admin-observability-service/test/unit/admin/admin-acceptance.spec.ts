/**
 * Tests d'acceptance — AdminService
 *
 * Vérifie les critères d'acceptance définis dans la spec XML :
 *
 *   AOS-CR-001 : Un élément masqué n'est pas supprimé.
 *   AOS-CR-002 : Un TI ne peut pas s'auto-attribuer un accès AF.
 *   AOS-CR-003 : Toute action admin sensible conserve l'identité réelle de l'opérateur.
 *   AOS-CR-004 : Les indicateurs non fonctionnels sont consultables.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { AdminService } from '../../../src/admin/admin.service';
import { ActivityLog } from '../../../src/admin/entities/activity-log.entity';
import { TechnicalLog } from '../../../src/admin/entities/technical-log.entity';
import { VisibilityOverride } from '../../../src/admin/entities/visibility-override.entity';
import { SiteMetadata } from '../../../src/admin/entities/site-metadata.entity';

const TI_ID = 'ti-0000-4000-e000-eeeeeeeeeeee';
const RP_ID = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AF_ID = 'af-0000-4000-f000-ffffffffffff';

function buildMockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
}

describe('AdminService — Critères d\'acceptance', () => {
  let adminService: AdminService;
  let activityLogRepo: ReturnType<typeof buildMockRepo>;
  let technicalLogRepo: ReturnType<typeof buildMockRepo>;
  let visibilityOverrideRepo: ReturnType<typeof buildMockRepo>;
  let siteMetadataRepo: ReturnType<typeof buildMockRepo>;

  beforeEach(async () => {
    activityLogRepo = buildMockRepo();
    technicalLogRepo = buildMockRepo();
    visibilityOverrideRepo = buildMockRepo();
    siteMetadataRepo = buildMockRepo();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(ActivityLog), useValue: activityLogRepo },
        { provide: getRepositoryToken(TechnicalLog), useValue: technicalLogRepo },
        { provide: getRepositoryToken(VisibilityOverride), useValue: visibilityOverrideRepo },
        { provide: getRepositoryToken(SiteMetadata), useValue: siteMetadataRepo },
      ],
    }).compile();

    adminService = moduleRef.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─────────────────────────────────────────────────────────────────────────
  // AOS-CR-001: Un élément masqué n'est pas supprimé
  // ─────────────────────────────────────────────────────────────────────────

  describe('AOS-CR-001: Un élément masqué n\'est pas supprimé', () => {
    it('la création d\'un masquage ne supprime pas la ressource', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(null);
      const savedOverride = {
        id: 'ov-001',
        resourceType: 'content',
        resourceId: 'content-001',
        isActive: true,
        createdById: TI_ID,
        createdByRole: 'technicien_informatique',
        reason: null,
        liftedById: null,
        liftedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      visibilityOverrideRepo.create.mockReturnValue(savedOverride);
      visibilityOverrideRepo.save.mockResolvedValue(savedOverride);

      const result = await adminService.createVisibilityOverride(
        { resourceType: 'content', resourceId: 'content-001' },
        TI_ID,
        'technicien_informatique',
      );

      // L'élément masqué a isActive=true (masqué mais pas supprimé)
      expect(result.isActive).toBe(true);
      // Aucune suppression de la ressource originale
      expect(visibilityOverrideRepo.remove).not.toHaveBeenCalled();
    });

    it('la levée d\'un masquage ne supprime pas la ressource originale', async () => {
      const activeOverride = {
        id: 'ov-001',
        resourceType: 'content',
        resourceId: 'content-001',
        isActive: true,
        createdById: TI_ID,
        createdByRole: 'technicien_informatique',
        reason: null,
        liftedById: null,
        liftedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      visibilityOverrideRepo.findOne.mockResolvedValue(activeOverride);
      visibilityOverrideRepo.save.mockResolvedValue({ ...activeOverride, isActive: false, liftedById: TI_ID, liftedAt: new Date() });

      await adminService.liftVisibilityOverride('ov-001', TI_ID, 'technicien_informatique');

      // Seul le masquage est modifié, pas la ressource originale
      expect(visibilityOverrideRepo.remove).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AOS-CR-002: Un TI ne peut pas s'auto-attribuer un accès AF
  // ─────────────────────────────────────────────────────────────────────────

  describe('AOS-CR-002: Un TI ne peut pas s\'auto-attribuer un accès AF', () => {
    it('une action de type grant.role.administrateur_financier est rejetée pour TI', async () => {
      await expect(
        adminService.logAdminAction(
          TI_ID,
          'technicien_informatique',
          'grant.role.administrateur_financier',
          'user',
          TI_ID,
          'Auto-attribution rôle AF',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('le TI peut s\'attribuer d\'autres droits techniques non AF', async () => {
      const savedLog = {
        id: 'log-001',
        operatorId: TI_ID,
        operatorRole: 'technicien_informatique',
        action: 'grant.access.monitoring',
        resourceType: 'user',
        resourceId: TI_ID,
        details: 'Accès monitoring auto-attribué',
        correlationId: null,
        ipAddress: null,
        createdAt: new Date(),
      };
      activityLogRepo.create.mockReturnValue(savedLog);
      activityLogRepo.save.mockResolvedValue(savedLog);

      const result = await adminService.logAdminAction(
        TI_ID,
        'technicien_informatique',
        'grant.access.monitoring',
        'user',
        TI_ID,
        'Accès monitoring auto-attribué',
      );

      expect(result).toBeDefined();
      expect(activityLogRepo.save).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AOS-CR-003: Toute action admin sensible conserve l'identité réelle de l'opérateur
  // ─────────────────────────────────────────────────────────────────────────

  describe('AOS-CR-003: Toute action admin sensible conserve l\'identité réelle de l\'opérateur', () => {
    it('la modification de métadonnée conserve l\'identité de l\'opérateur', async () => {
      const existingMetadata = {
        id: 'mt-001',
        metaKey: 'og_title',
        metaValue: 'VisioMaths',
        description: null,
        lastModifiedById: 'old-ti-id',
        lastModifiedByRole: 'technicien_informatique',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      siteMetadataRepo.findOne.mockResolvedValue(existingMetadata);
      siteMetadataRepo.save.mockImplementation((data) => Promise.resolve(data));

      await adminService.updateSiteMetadata(
        'mt-001',
        { metaValue: 'VisioMaths — Soutien scolaire premium' },
        TI_ID,
        'technicien_informatique',
      );

      expect(siteMetadataRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastModifiedById: TI_ID,
          lastModifiedByRole: 'technicien_informatique',
        }),
      );
    });

    it('logAdminAction enregistre l\'identité réelle de l\'opérateur', async () => {
      const savedLog = {
        id: 'log-cr-003',
        operatorId: RP_ID,
        operatorRole: 'responsable_pedagogique',
        action: 'content.validated',
        resourceType: 'content',
        resourceId: 'content-001',
        details: 'Contenu validé par RP',
        correlationId: 'corr-003',
        ipAddress: null,
        createdAt: new Date(),
      };
      activityLogRepo.create.mockReturnValue(savedLog);
      activityLogRepo.save.mockResolvedValue(savedLog);

      const result = await adminService.logAdminAction(
        RP_ID,
        'responsable_pedagogique',
        'content.validated',
        'content',
        'content-001',
        'Contenu validé par RP',
        'corr-003',
      );

      expect(result.operatorId).toBe(RP_ID);
      expect(result.operatorRole).toBe('responsable_pedagogique');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AOS-CR-004: Les indicateurs non fonctionnels sont consultables
  // ─────────────────────────────────────────────────────────────────────────

  describe('AOS-CR-004: Les indicateurs non fonctionnels sont consultables', () => {
    it('le TI peut consulter les indicateurs de disponibilité et performance', async () => {
      const result = await adminService.getHealthMetrics('technicien_informatique');

      expect(result.availabilityTarget).toBe('99%');
      expect(result.performanceTarget).toBe('<2s');
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('le RP peut consulter les indicateurs', async () => {
      const result = await adminService.getHealthMetrics('responsable_pedagogique');
      expect(result.availabilityTarget).toBeDefined();
    });

    it('l\'AF peut consulter les indicateurs', async () => {
      const result = await adminService.getHealthMetrics('administrateur_financier');
      expect(result.performanceTarget).toBeDefined();
    });

    it('les rôles non autorisés ne peuvent pas consulter les indicateurs', async () => {
      await expect(
        adminService.getHealthMetrics('formateur'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        adminService.getHealthMetrics('eleve'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
