import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, CanActivate } from '@nestjs/common';
import { InternalController } from '../../src/internal/internal.controller';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { NotificationService } from '../../src/notification/notification.service';
import { NotificationType } from '../../src/notification/entities/notification.entity';
import { InternalGuard } from '../../src/common/guards/internal.guard';

const mockDashboardService = () => ({
  initializeDashboard: jest.fn(),
  getPreference: jest.fn(),
});

const mockNotificationService = () => ({
  create: jest.fn(),
});

/** Guard passthrough for unit tests — authentication is tested separately */
const passThroughGuard: CanActivate = { canActivate: () => true };

describe('InternalController', () => {
  let internalController: InternalController;
  let dashboardService: ReturnType<typeof mockDashboardService>;
  let notificationService: ReturnType<typeof mockNotificationService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: DashboardService, useFactory: mockDashboardService },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    })
      .overrideGuard(InternalGuard)
      .useValue(passThroughGuard)
      .compile();

    internalController = moduleRef.get<InternalController>(InternalController);
    dashboardService = moduleRef.get(DashboardService);
    notificationService = moduleRef.get(NotificationService);
  });

  describe('initializeDashboard', () => {
    it('calls dashboardService.initializeDashboard with correct params', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      const role = 'eleve';
      const expectedResult = { id: 'pref-001', userId, role, widgetConfig: {} };

      dashboardService.initializeDashboard.mockResolvedValue(expectedResult);

      const result = await internalController.initializeDashboard({ userId, role });

      expect(dashboardService.initializeDashboard).toHaveBeenCalledWith({ id: userId, role });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('notify', () => {
    it('creates a notification for a targetUserId', async () => {
      const targetUserId = '00000000-0000-0000-0000-000000000010';
      const dto = {
        targetUserId,
        type: NotificationType.TEACHER_REQUEST_CREATED,
        title: 'Nouvelle demande',
        message: 'Une demande professeur a été créée.',
      };
      const createdNotification = {
        id: 'notif-001',
        userId: targetUserId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        isRead: false,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      // NotificationService.create already returns the explicit response DTO
      // shape (see notification.service.spec.ts) — the controller is a thin
      // passthrough and must not reshape it further.
      notificationService.create.mockResolvedValue(createdNotification);

      const result = await internalController.notify(dto);

      expect(notificationService.create).toHaveBeenCalledWith({
        userId: targetUserId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        metadata: undefined,
      });
      expect(result).toEqual(createdNotification);
    });

    it('creates a notification for a targetRole using role: prefix', async () => {
      const dto = {
        targetRole: 'responsable_pedagogique',
        type: NotificationType.PAYMENT_FAILED,
        title: 'Défaut de paiement',
        message: 'Un paiement a échoué.',
      };
      const expectedNotif = { id: 'notif-002', userId: 'role:responsable_pedagogique', ...dto };

      notificationService.create.mockResolvedValue(expectedNotif);

      const result = await internalController.notify(dto);

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'role:responsable_pedagogique' }),
      );
    });

    it('throws BadRequestException when neither targetUserId nor targetRole provided', async () => {
      const dto = {
        type: NotificationType.SYSTEM,
        title: 'Oops',
        message: 'Missing target.',
      };

      await expect(internalController.notify(dto as any)).rejects.toThrow(BadRequestException);
      expect(notificationService.create).not.toHaveBeenCalled();
    });

    it('passes metadata to the notification when provided', async () => {
      const targetUserId = '00000000-0000-0000-0000-000000000010';
      const metadata = { sessionId: 'session-abc', eventType: 'reminder' };
      const dto = {
        targetUserId,
        type: NotificationType.SESSION_REMINDER,
        title: 'Rappel séance',
        message: 'Votre séance commence dans 15 minutes.',
        metadata,
      };

      notificationService.create.mockResolvedValue({ id: 'notif-003', userId: targetUserId });

      await internalController.notify(dto);

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });
  });
});
