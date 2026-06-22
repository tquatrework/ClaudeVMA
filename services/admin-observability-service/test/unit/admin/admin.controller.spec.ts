/**
 * Unit tests — AdminController
 *
 * Couvre :
 *   - getActivityLog()            → délégation au service
 *   - getTechnicalLogs()          → délégation au service
 *   - createVisibilityOverride()  → délégation au service
 *   - liftVisibilityOverride()    → délégation au service
 *   - getHealthMetrics()          → délégation au service
 *   - updateSiteMetadata()        → délégation au service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AdminController } from '../../../src/admin/admin.controller';
import { AdminService } from '../../../src/admin/admin.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { AuthenticatedUser } from '../../../src/common/guards/jwt-auth.guard';

const TI_USER: AuthenticatedUser = {
  id: 'ti-0000-4000-e000-eeeeeeeeeeee',
  email: 'ti@visiomaths.fr',
  role: 'technicien_informatique',
  validationStatus: 'validated',
  jti: 'jti-ti-001',
};

const RP_USER: AuthenticatedUser = {
  id: 'rp-0000-4000-a000-aaaaaaaaaaaa',
  email: 'rp@visiomaths.fr',
  role: 'responsable_pedagogique',
  validationStatus: 'validated',
  jti: 'jti-rp-001',
};

/** Guard mock that always passes authentication. */
const mockJwtAuthGuard = { canActivate: (_context: ExecutionContext) => true };
/** Guard mock that always passes role check. */
const mockRolesGuard = { canActivate: (_context: ExecutionContext) => true };

describe('AdminController', () => {
  let adminController: AdminController;
  let adminService: jest.Mocked<AdminService>;

  beforeEach(async () => {
    const mockAdminService = {
      findActivityLogs: jest.fn(),
      findTechnicalLogs: jest.fn(),
      createVisibilityOverride: jest.fn(),
      liftVisibilityOverride: jest.fn(),
      getHealthMetrics: jest.fn(),
      updateSiteMetadata: jest.fn(),
      logAdminAction: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard).useValue(mockRolesGuard)
      .compile();

    adminController = moduleRef.get<AdminController>(AdminController);
    adminService = moduleRef.get(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getActivityLog()', () => {
    it('délègue au service avec le rôle de l\'utilisateur courant', async () => {
      adminService.findActivityLogs.mockResolvedValue({ data: [], total: 0 });

      await adminController.getActivityLog({}, TI_USER, 'corr-001');

      expect(adminService.findActivityLogs).toHaveBeenCalledWith({}, TI_USER.role);
    });
  });

  describe('getTechnicalLogs()', () => {
    it('délègue au service avec le rôle TI', async () => {
      adminService.findTechnicalLogs.mockResolvedValue({ data: [], total: 0 });

      await adminController.getTechnicalLogs({}, TI_USER);

      expect(adminService.findTechnicalLogs).toHaveBeenCalledWith({}, TI_USER.role);
    });
  });

  describe('createVisibilityOverride()', () => {
    it('délègue au service avec l\'id et le rôle de l\'opérateur', async () => {
      const createDto = { resourceType: 'forum', resourceId: 'forum-001', reason: 'Incident' };
      const createdOverride = {
        id: 'ov-001',
        ...createDto,
        createdById: TI_USER.id,
        createdByRole: TI_USER.role,
        isActive: true,
        liftedById: null,
        liftedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      adminService.createVisibilityOverride.mockResolvedValue(createdOverride as any);

      await adminController.createVisibilityOverride(createDto, TI_USER);

      expect(adminService.createVisibilityOverride).toHaveBeenCalledWith(
        createDto,
        TI_USER.id,
        TI_USER.role,
      );
    });
  });

  describe('liftVisibilityOverride()', () => {
    it('délègue au service avec l\'id du masquage et l\'opérateur', async () => {
      adminService.liftVisibilityOverride.mockResolvedValue({
        id: 'ov-001',
        isActive: false,
      } as any);

      await adminController.liftVisibilityOverride('ov-001', TI_USER);

      expect(adminService.liftVisibilityOverride).toHaveBeenCalledWith(
        'ov-001',
        TI_USER.id,
        TI_USER.role,
      );
    });
  });

  describe('getHealthMetrics()', () => {
    it('délègue au service avec le rôle de l\'utilisateur', async () => {
      adminService.getHealthMetrics.mockResolvedValue({
        status: 'ok',
        availabilityTarget: '99%',
        performanceTarget: '<2s',
        timestamp: new Date().toISOString(),
      });

      await adminController.getHealthMetrics(RP_USER);

      expect(adminService.getHealthMetrics).toHaveBeenCalledWith(RP_USER.role);
    });
  });

  describe('updateSiteMetadata()', () => {
    it('délègue au service avec l\'id de la métadonnée et l\'opérateur', async () => {
      const updateDto = { metaValue: 'https://new.visiomaths.fr' };
      adminService.updateSiteMetadata.mockResolvedValue({
        id: 'mt-001',
        metaKey: 'home_url',
        metaValue: updateDto.metaValue,
        lastModifiedById: TI_USER.id,
        lastModifiedByRole: TI_USER.role,
      } as any);

      await adminController.updateSiteMetadata('mt-001', updateDto, TI_USER);

      expect(adminService.updateSiteMetadata).toHaveBeenCalledWith(
        'mt-001',
        updateDto,
        TI_USER.id,
        TI_USER.role,
      );
    });
  });
});
