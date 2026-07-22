import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, NotFoundException } from '@nestjs/common';
import { NotificationController } from '../../src/notification/notification.controller';
import { NotificationService } from '../../src/notification/notification.service';
import { NotificationType } from '../../src/notification/entities/notification.entity';
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
    it('delegates to the service with the actor id and query', async () => {
      const actor = buildAuthUser();
      service.findByUser.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });

      await controller.findAll(actor, { page: 1, limit: 20 });

      expect(service.findByUser).toHaveBeenCalledWith(actor.id, { page: 1, limit: 20 });
    });

    it('returns a paginated response with explicit notification DTOs', async () => {
      const actor = buildAuthUser();
      const notification = {
        id: 'notif-1',
        userId: actor.id,
        type: NotificationType.SYSTEM,
        title: 'Titre',
        message: 'Message',
        isRead: false,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      service.findByUser.mockResolvedValue({
        data: [notification],
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      });

      const result = await controller.findAll(actor, { page: 1, limit: 20 });

      expect(result.data).toEqual([notification]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
    });
  });

  describe('markAsRead', () => {
    it('delegates to the service with notification id and actor id', async () => {
      const actor = buildAuthUser();
      service.markAsRead.mockResolvedValue({
        id: 'notif-1',
        userId: actor.id,
        type: NotificationType.SYSTEM,
        title: 'Titre',
        message: 'Message',
        isRead: true,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      await controller.markAsRead('notif-1', actor);

      expect(service.markAsRead).toHaveBeenCalledWith('notif-1', actor.id);
    });

    it('returns the notification as an explicit response DTO', async () => {
      const actor = buildAuthUser();
      const notification = {
        id: 'notif-1',
        userId: actor.id,
        type: NotificationType.SYSTEM,
        title: 'Titre',
        message: 'Message',
        isRead: true,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      service.markAsRead.mockResolvedValue(notification);

      const result = await controller.markAsRead('notif-1', actor);

      expect(result).toEqual(notification);
    });

    it('propagates NotFoundException when the notification cannot be marked as read', async () => {
      const actor = buildAuthUser();
      service.markAsRead.mockRejectedValue(new NotFoundException('Notification notif-1 not found'));

      await expect(controller.markAsRead('notif-1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('delegates to the service with notification id and actor id', async () => {
      const actor = buildAuthUser();
      service.remove.mockResolvedValue({ deleted: true });

      await controller.remove('notif-1', actor);

      expect(service.remove).toHaveBeenCalledWith('notif-1', actor.id);
    });

    it('returns a deletion confirmation', async () => {
      const actor = buildAuthUser();
      service.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('notif-1', actor);

      expect(result).toEqual({ deleted: true });
    });

    it('propagates NotFoundException for a non-existent notification', async () => {
      const actor = buildAuthUser();
      service.remove.mockRejectedValue(new NotFoundException('Notification notif-1 not found'));

      await expect(controller.remove('notif-1', actor)).rejects.toThrow(NotFoundException);
    });
  });
});
