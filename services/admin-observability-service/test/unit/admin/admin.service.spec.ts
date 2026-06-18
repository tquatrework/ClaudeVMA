/**
 * Unit tests — AdminService
 *
 * Couvre :
 *   - findActivityLogs()           → accès TI/RP/AF, rejet élève/formateur
 *   - findTechnicalLogs()          → accès TI uniquement
 *   - createVisibilityOverride()   → TI uniquement, doublon interdit
 *   - liftVisibilityOverride()     → TI uniquement, 404, déjà levé
 *   - updateSiteMetadata()         → TI uniquement, 404
 *   - getHealthMetrics()           → accès TI/RP/AF
 *   - logAdminAction()             → AOS-BR-002: TI ne peut pas s'auto-attribuer les droits AF
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from '../../../src/admin/admin.service';
import { ActivityLog } from '../../../src/admin/entities/activity-log.entity';
import { TechnicalLog } from '../../../src/admin/entities/technical-log.entity';
import { VisibilityOverride } from '../../../src/admin/entities/visibility-override.entity';
import { SiteMetadata } from '../../../src/admin/entities/site-metadata.entity';
import { LogLevel } from '../../../src/common/enums/log-level.enum';

const TI_ID   = 'ti-0000-4000-e000-eeeeeeeeeeee';
const RP_ID   = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AF_ID   = 'af-0000-4000-f000-ffffffffffff';
const FORMATEUR_ID = 'fo-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';

const OVERRIDE_ID  = 'ov-0000-4000-0000-000000000000';
const METADATA_ID  = 'mt-0000-4000-0000-000000000000';

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

function buildSampleOverride(overrides: Partial<VisibilityOverride> = {}): VisibilityOverride {
  return {
    id: OVERRIDE_ID,
    resourceType: 'forum',
    resourceId: 'forum-001',
    reason: 'Incident signalé',
    createdById: TI_ID,
    createdByRole: 'technicien_informatique',
    isActive: true,
    liftedById: null,
    liftedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSampleMetadata(overrides: Partial<SiteMetadata> = {}): SiteMetadata {
  return {
    id: METADATA_ID,
    metaKey: 'home_url',
    metaValue: 'https://visiomaths.fr',
    description: 'URL de la page d\'accueil',
    lastModifiedById: TI_ID,
    lastModifiedByRole: 'technicien_informatique',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AdminService', () => {
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
  // findActivityLogs()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findActivityLogs()', () => {
    it('le TI peut lister le journal d\'activité', async () => {
      activityLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await adminService.findActivityLogs({}, 'technicien_informatique');
      expect(result.total).toBe(0);
    });

    it('le RP peut lister le journal d\'activité', async () => {
      activityLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await adminService.findActivityLogs({}, 'responsable_pedagogique');
      expect(result).toBeDefined();
    });

    it('l\'AF peut lister le journal d\'activité', async () => {
      activityLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await adminService.findActivityLogs({}, 'administrateur_financier');
      expect(result).toBeDefined();
    });

    it('lève ForbiddenException si un formateur tente de lire le journal', async () => {
      await expect(
        adminService.findActivityLogs({}, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un élève tente de lire le journal', async () => {
      await expect(
        adminService.findActivityLogs({}, 'eleve'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applique les filtres de rôle opérateur et type de ressource', async () => {
      activityLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await adminService.findActivityLogs(
        { operatorRole: 'responsable_pedagogique', resourceType: 'content' },
        'technicien_informatique',
      );

      expect(activityLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            operatorRole: 'responsable_pedagogique',
            resourceType: 'content',
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // findTechnicalLogs()
  // ─────────────────────────────────────────────────────────────────────────

  describe('findTechnicalLogs()', () => {
    it('le TI peut lire les logs techniques', async () => {
      technicalLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await adminService.findTechnicalLogs({}, 'technicien_informatique');
      expect(result.total).toBe(0);
    });

    it('lève ForbiddenException si un RP tente de lire les logs techniques', async () => {
      await expect(
        adminService.findTechnicalLogs({}, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un AF tente de lire les logs techniques', async () => {
      await expect(
        adminService.findTechnicalLogs({}, 'administrateur_financier'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un formateur tente de lire les logs techniques', async () => {
      await expect(
        adminService.findTechnicalLogs({}, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('filtre par niveau de log', async () => {
      technicalLogRepo.findAndCount.mockResolvedValue([[], 0]);

      await adminService.findTechnicalLogs(
        { level: LogLevel.ERROR },
        'technicien_informatique',
      );

      expect(technicalLogRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ level: LogLevel.ERROR }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createVisibilityOverride()
  // ─────────────────────────────────────────────────────────────────────────

  describe('createVisibilityOverride()', () => {
    const validCreateDto = {
      resourceType: 'forum',
      resourceId: 'forum-001',
      reason: 'Contenu signalé',
    };

    it('le TI peut créer un masquage temporaire', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(null);
      const savedOverride = buildSampleOverride();
      visibilityOverrideRepo.create.mockReturnValue(savedOverride);
      visibilityOverrideRepo.save.mockResolvedValue(savedOverride);

      const result = await adminService.createVisibilityOverride(validCreateDto, TI_ID, 'technicien_informatique');

      expect(result.isActive).toBe(true);
      expect(result.resourceType).toBe('forum');
    });

    it('AOS-BR-001: l\'élément masqué n\'est pas supprimé (isActive=true)', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(null);
      const savedOverride = buildSampleOverride();
      visibilityOverrideRepo.create.mockReturnValue(savedOverride);
      visibilityOverrideRepo.save.mockResolvedValue(savedOverride);

      const result = await adminService.createVisibilityOverride(validCreateDto, TI_ID, 'technicien_informatique');

      // The resource is MASKED, not deleted — isActive reflects the masking
      expect(result.isActive).toBe(true);
      // Ensure no delete was called
      expect(visibilityOverrideRepo.remove).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si un RP tente de créer un masquage', async () => {
      await expect(
        adminService.createVisibilityOverride(validCreateDto, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève ForbiddenException si un AF tente de créer un masquage', async () => {
      await expect(
        adminService.createVisibilityOverride(validCreateDto, AF_ID, 'administrateur_financier'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si un masquage actif existe déjà pour cette ressource', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(buildSampleOverride());

      await expect(
        adminService.createVisibilityOverride(validCreateDto, TI_ID, 'technicien_informatique'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // liftVisibilityOverride()
  // ─────────────────────────────────────────────────────────────────────────

  describe('liftVisibilityOverride()', () => {
    it('le TI peut lever un masquage', async () => {
      const activeOverride = buildSampleOverride({ isActive: true });
      visibilityOverrideRepo.findOne.mockResolvedValue(activeOverride);
      visibilityOverrideRepo.save.mockResolvedValue({ ...activeOverride, isActive: false, liftedById: TI_ID, liftedAt: new Date() });

      const result = await adminService.liftVisibilityOverride(OVERRIDE_ID, TI_ID, 'technicien_informatique');

      expect(visibilityOverrideRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, liftedById: TI_ID }),
      );
    });

    it('AOS-BR-001: lever un masquage ne supprime pas la ressource originale', async () => {
      const activeOverride = buildSampleOverride({ isActive: true });
      visibilityOverrideRepo.findOne.mockResolvedValue(activeOverride);
      visibilityOverrideRepo.save.mockResolvedValue({ ...activeOverride, isActive: false });

      await adminService.liftVisibilityOverride(OVERRIDE_ID, TI_ID, 'technicien_informatique');

      // Only saves the override (not deletes the original resource)
      expect(visibilityOverrideRepo.remove).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si un RP tente de lever un masquage', async () => {
      await expect(
        adminService.liftVisibilityOverride(OVERRIDE_ID, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le masquage est introuvable', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(null);

      await expect(
        adminService.liftVisibilityOverride(OVERRIDE_ID, TI_ID, 'technicien_informatique'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le masquage est déjà levé', async () => {
      visibilityOverrideRepo.findOne.mockResolvedValue(buildSampleOverride({ isActive: false }));

      await expect(
        adminService.liftVisibilityOverride(OVERRIDE_ID, TI_ID, 'technicien_informatique'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateSiteMetadata()
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateSiteMetadata()', () => {
    it('le TI peut modifier les métadonnées du site', async () => {
      const existingMetadata = buildSampleMetadata();
      siteMetadataRepo.findOne.mockResolvedValue(existingMetadata);
      const updatedMetadata = { ...existingMetadata, metaValue: 'https://new.visiomaths.fr' };
      siteMetadataRepo.save.mockResolvedValue(updatedMetadata);

      const result = await adminService.updateSiteMetadata(
        METADATA_ID,
        { metaValue: 'https://new.visiomaths.fr' },
        TI_ID,
        'technicien_informatique',
      );

      expect(siteMetadataRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metaValue: 'https://new.visiomaths.fr',
          lastModifiedById: TI_ID,
        }),
      );
    });

    it('AOS-BR-003: l\'identité réelle de l\'opérateur est conservée', async () => {
      const existingMetadata = buildSampleMetadata();
      siteMetadataRepo.findOne.mockResolvedValue(existingMetadata);
      siteMetadataRepo.save.mockImplementation((data) => Promise.resolve(data));

      await adminService.updateSiteMetadata(
        METADATA_ID,
        { metaValue: 'new-value' },
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

    it('lève ForbiddenException si un RP tente de modifier les métadonnées', async () => {
      await expect(
        adminService.updateSiteMetadata(METADATA_ID, { metaValue: 'test' }, RP_ID, 'responsable_pedagogique'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si la métadonnée est introuvable', async () => {
      siteMetadataRepo.findOne.mockResolvedValue(null);

      await expect(
        adminService.updateSiteMetadata(METADATA_ID, { metaValue: 'test' }, TI_ID, 'technicien_informatique'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getHealthMetrics()
  // ─────────────────────────────────────────────────────────────────────────

  describe('getHealthMetrics()', () => {
    it('le TI peut consulter les indicateurs de performance', async () => {
      const result = await adminService.getHealthMetrics('technicien_informatique');
      expect(result.status).toBe('ok');
      expect(result.availabilityTarget).toBe('99%');
    });

    it('le RP peut consulter les indicateurs de performance', async () => {
      const result = await adminService.getHealthMetrics('responsable_pedagogique');
      expect(result).toBeDefined();
    });

    it('l\'AF peut consulter les indicateurs de performance', async () => {
      const result = await adminService.getHealthMetrics('administrateur_financier');
      expect(result).toBeDefined();
    });

    it('AOS-BR-004: les indicateurs non fonctionnels sont consultables', async () => {
      const result = await adminService.getHealthMetrics('technicien_informatique');
      expect(result.availabilityTarget).toBeDefined();
      expect(result.performanceTarget).toBeDefined();
    });

    it('lève ForbiddenException si un formateur tente de consulter les indicateurs', async () => {
      await expect(
        adminService.getHealthMetrics('formateur'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // logAdminAction()
  // ─────────────────────────────────────────────────────────────────────────

  describe('logAdminAction()', () => {
    it('enregistre une action admin sensible avec l\'identité réelle de l\'opérateur', async () => {
      const savedLog = {
        id: 'log-0001',
        operatorId: TI_ID,
        operatorRole: 'technicien_informatique',
        action: 'user.account.disabled',
        resourceType: 'user',
        resourceId: 'user-001',
        details: 'Compte désactivé suite à incident',
        correlationId: 'corr-001',
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };
      activityLogRepo.create.mockReturnValue(savedLog);
      activityLogRepo.save.mockResolvedValue(savedLog);

      const result = await adminService.logAdminAction(
        TI_ID,
        'technicien_informatique',
        'user.account.disabled',
        'user',
        'user-001',
        'Compte désactivé suite à incident',
        'corr-001',
        '127.0.0.1',
      );

      expect(result.operatorId).toBe(TI_ID);
      expect(result.operatorRole).toBe('technicien_informatique');
    });

    it('AOS-BR-002: le TI ne peut pas s\'auto-attribuer les droits AF', async () => {
      await expect(
        adminService.logAdminAction(
          TI_ID,
          'technicien_informatique',
          'grant.role.administrateur_financier',
          'user',
          TI_ID,
          'Auto-attribution de rôle AF',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('le TI peut logger d\'autres types d\'actions sensibles', async () => {
      const savedLog = {
        id: 'log-0002',
        operatorId: TI_ID,
        operatorRole: 'technicien_informatique',
        action: 'system.maintenance.mode',
        resourceType: 'system',
        resourceId: 'platform',
        details: 'Passage en mode maintenance',
        correlationId: null,
        ipAddress: null,
        createdAt: new Date(),
      };
      activityLogRepo.create.mockReturnValue(savedLog);
      activityLogRepo.save.mockResolvedValue(savedLog);

      const result = await adminService.logAdminAction(
        TI_ID,
        'technicien_informatique',
        'system.maintenance.mode',
        'system',
        'platform',
        'Passage en mode maintenance',
      );

      expect(activityLogRepo.save).toHaveBeenCalled();
      expect(result.action).toBe('system.maintenance.mode');
    });
  });
});
