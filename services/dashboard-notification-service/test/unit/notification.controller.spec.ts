import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, NotFoundException } from '@nestjs/common';
import { NotificationController } from '../../src/notification/notification.controller';
import { NotificationService } from '../../src/notification/notification.service';
import { AuthUser } from '../../src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';

const mockNotificationService = () => ({
  findByUser: jest.fn(),
  markAsRead: jest.fn(),
  remove: jest.fn(),
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

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: ReturnType<typeof mockNotificationService>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useFactory: mockNotificationService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(passThroughGuard)
      .compile();

    controller = moduleRef.get<NotificationController>(NotificationController);
    service = moduleRef.get(NotificationService);
  });

  describe('findAll', () => {
    it('delegates to the service with a typed Actor and the validated query', async () => {
      const user = buildAuthUser();
      const expectedResponse = { data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } };
      service.findByUser.mockResolvedValue(expectedResponse);

      const result = await controller.findAll(user, { page: 1, limit: 20 });

      expect(service.findByUser).toHaveBeenCalledWith({ id: user.id, role: user.role }, { page: 1, limit: 20 });
      expect(result).toBe(expectedResponse);
    });
  });

  describe('markAsRead', () => {
    it('delegates to the service with the notification id and a typed Actor', async () => {
      const user = buildAuthUser();
      const expectedResponse = { id: 'notif-1', userId: user.id, isRead: true };
      service.markAsRead.mockResolvedValue(expectedResponse);

      const result = await controller.markAsRead('notif-1', user);

      expect(service.markAsRead).toHaveBeenCalledWith('notif-1', { id: user.id, role: user.role });
      expect(result).toBe(expectedResponse);
    });

    it('propagates NotFoundException when the notification cannot be marked as read', async () => {
      const user = buildAuthUser();
      service.markAsRead.mockRejectedValue(new NotFoundException('Notification notif-1 not found'));

      await expect(controller.markAsRead('notif-1', user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('delegates to the service with the notification id and a typed Actor', async () => {
      const user = buildAuthUser();
      const expectedResponse = { deleted: true };
      service.remove.mockResolvedValue(expectedResponse);

      const result = await controller.remove('notif-1', user);

      expect(service.remove).toHaveBeenCalledWith('notif-1', { id: user.id, role: user.role });
      expect(result).toBe(expectedResponse);
    });

    it('propagates NotFoundException for a non-existent notification', async () => {
      const user = buildAuthUser();
      service.remove.mockRejectedValue(new NotFoundException('Notification notif-1 not found'));

      await expect(controller.remove('notif-1', user)).rejects.toThrow(NotFoundException);
    });
  });
});
