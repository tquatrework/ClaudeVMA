import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { DashboardController } from '../../src/dashboard/dashboard.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { NotificationType } from '../../src/notification/entities/notification.entity';
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
    it('delegates to the service with the authenticated actor id and role', async () => {
      const actor = buildAuthUser();
      service.getMyDashboard.mockResolvedValue({
        userId: actor.id,
        role: actor.role,
        widgets: [],
        notifications: [],
        generatedAt: '2024-01-01T00:00:00.000Z',
      });

      await controller.getMyDashboard(actor);

      expect(service.getMyDashboard).toHaveBeenCalledWith(actor.id, actor.role);
    });

    it('maps widgets and notifications to the explicit response DTO shape', async () => {
      const actor = buildAuthUser();
      service.getMyDashboard.mockResolvedValue({
        userId: actor.id,
        role: actor.role,
        widgets: [{ type: 'calendar', label: 'Calendrier', ref: 'calendar-service' }],
        notifications: [
          {
            id: 'notif-1',
            userId: actor.id,
            type: NotificationType.SYSTEM,
            title: 'Titre',
            message: 'Message',
            isRead: false,
            metadata: null,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        generatedAt: '2024-01-01T00:00:00.000Z',
      });

      const result = await controller.getMyDashboard(actor);

      expect(result.userId).toBe(actor.id);
      expect(result.role).toBe(actor.role);
      expect(result.widgets).toEqual([{ type: 'calendar', label: 'Calendrier', ref: 'calendar-service' }]);
      expect(result.notifications).toEqual([
        {
          id: 'notif-1',
          userId: actor.id,
          type: NotificationType.SYSTEM,
          title: 'Titre',
          message: 'Message',
          isRead: false,
          metadata: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]);
      expect(result.generatedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('does not leak extraneous widget fields beyond the response contract', async () => {
      const actor = buildAuthUser({ id: 'parent-uuid-001', role: 'parent_financeur' });
      service.getMyDashboard.mockResolvedValue({
        userId: actor.id,
        role: actor.role,
        widgets: [
          {
            type: 'linked_students',
            label: 'Élèves liés',
            ref: 'profile-service',
            note: 'excludes_personal_notebook',
            internalDebugFlag: true,
          },
        ],
        notifications: [],
        generatedAt: '2024-01-01T00:00:00.000Z',
      });

      const result = await controller.getMyDashboard(actor);

      expect(result.widgets[0]).toEqual({
        type: 'linked_students',
        label: 'Élèves liés',
        ref: 'profile-service',
        note: 'excludes_personal_notebook',
      });
      expect(result.widgets[0]).not.toHaveProperty('internalDebugFlag');
    });
  });

  describe('updatePreferences', () => {
    it('delegates to the service with actor id, role and dto', async () => {
      const actor = buildAuthUser();
      const dto = { widgetConfig: { showCalendar: false } };
      service.updatePreferences.mockResolvedValue({
        id: 'pref-001',
        userId: actor.id,
        role: actor.role,
        widgetConfig: dto.widgetConfig,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      });

      await controller.updatePreferences(actor, dto);

      expect(service.updatePreferences).toHaveBeenCalledWith(actor.id, actor.role, dto);
    });

    it('returns the saved preference as an explicit response DTO', async () => {
      const actor = buildAuthUser();
      const dto = { widgetConfig: { showCalendar: false } };
      service.updatePreferences.mockResolvedValue({
        id: 'pref-001',
        userId: actor.id,
        role: actor.role,
        widgetConfig: dto.widgetConfig,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      });

      const result = await controller.updatePreferences(actor, dto);

      expect(result).toEqual({
        id: 'pref-001',
        userId: actor.id,
        role: actor.role,
        widgetConfig: dto.widgetConfig,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      });
    });
  });
});
