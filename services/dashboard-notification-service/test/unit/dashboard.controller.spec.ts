import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { AuthUser } from '../../src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

const mockDashboardService = () => ({
  getMyDashboard: jest.fn(),
  updatePreferences: jest.fn(),
});

/** Guard passthrough for unit tests — authentication is tested at the guard/e2e level */
const passThroughGuard: CanActivate = { canActivate: () => true };

const buildAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-uuid-001',
  loginIdentifier: 'user@example.com',
  email: 'user@example.com',
  role: 'eleve',
  validationStatus: 'validated',
  jti: 'jti-test',
  ...overrides,
});

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: ReturnType<typeof mockDashboardService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useFactory: mockDashboardService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passThroughGuard)
      .compile();

    controller = moduleRef.get<DashboardController>(DashboardController);
    service = moduleRef.get(DashboardService);
  });

  describe('getMyDashboard', () => {
    it('delegates to the service with a typed Actor built from the authenticated user', async () => {
      const user = buildAuthUser();
      const expectedResponse = {
        userId: user.id,
        role: user.role,
        widgets: [],
        notifications: [],
        generatedAt: '2024-01-01T00:00:00.000Z',
      };
      service.getMyDashboard.mockResolvedValue(expectedResponse);

      const result = await controller.getMyDashboard(user);

      expect(service.getMyDashboard).toHaveBeenCalledWith({ id: user.id, role: user.role });
      expect(result).toBe(expectedResponse);
    });
  });

  describe('updatePreferences', () => {
    it('delegates to the service with a typed Actor and the validated dto', async () => {
      const user = buildAuthUser();
      const dto = { widgetConfig: { showCalendar: false } };
      const expectedResponse = {
        id: 'pref-001',
        userId: user.id,
        role: user.role,
        widgetConfig: dto.widgetConfig,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      };
      service.updatePreferences.mockResolvedValue(expectedResponse);

      const result = await controller.updatePreferences(user, dto);

      expect(service.updatePreferences).toHaveBeenCalledWith({ id: user.id, role: user.role }, dto);
      expect(result).toBe(expectedResponse);
    });
  });
});
