import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from '../../src/notification/notification.service';
import { Notification, NotificationType } from '../../src/notification/entities/notification.entity';
import { CreateNotificationDto } from '../../src/notification/dto/create-notification.dto';
import { ListNotificationsDto } from '../../src/notification/dto/list-notifications.dto';
import { Actor } from '../../src/common/types/actor';

const mockNotificationRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const buildActor = (overrides: Partial<Actor> = {}): Actor => ({
  id: 'user-uuid-001',
  role: 'eleve',
  ...overrides,
});

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let notificationRepository: ReturnType<typeof mockNotificationRepository>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useFactory: mockNotificationRepository,
        },
      ],
    }).compile();

    notificationService = moduleRef.get<NotificationService>(NotificationService);
    notificationRepository = moduleRef.get(getRepositoryToken(Notification));
  });

  describe('create', () => {
    it('creates and saves a notification', async () => {
      const dto: CreateNotificationDto = {
        userId: 'user-uuid-001',
        type: NotificationType.SYSTEM,
        title: 'Test title',
        message: 'Test message',
      };
      const createdNotif = { id: 'notif-001', ...dto, isRead: false, metadata: null, createdAt: new Date('2024-01-01T00:00:00.000Z') };

      notificationRepository.create.mockReturnValue(createdNotif);
      notificationRepository.save.mockResolvedValue(createdNotif);

      const result = await notificationService.create(dto);

      expect(notificationRepository.create).toHaveBeenCalledWith(dto);
      expect(notificationRepository.save).toHaveBeenCalledWith(createdNotif);
      expect(result).toEqual(createdNotif);
    });

    it('does not leak internal fields beyond the response contract', async () => {
      const dto: CreateNotificationDto = {
        userId: 'user-uuid-001',
        type: NotificationType.SYSTEM,
        title: 'Test title',
        message: 'Test message',
      };
      const persistedNotification = {
        id: 'notif-001',
        ...dto,
        isRead: false,
        metadata: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        internalDebugFlag: true,
      };

      notificationRepository.create.mockReturnValue(persistedNotification);
      notificationRepository.save.mockResolvedValue(persistedNotification);

      const result = await notificationService.create(dto);

      expect(result).not.toHaveProperty('internalDebugFlag');
    });
  });

  describe('findByUser', () => {
    it('returns paginated notifications for the actor', async () => {
      const actor = buildActor();
      const query: ListNotificationsDto = { page: 1, limit: 20 };
      const notifications = [
        { id: 'notif-1', userId: actor.id, title: 'Notif 1', isRead: false },
        { id: 'notif-2', userId: actor.id, title: 'Notif 2', isRead: true },
      ];
      notificationRepository.findAndCount.mockResolvedValue([notifications, 2]);

      const result = await notificationService.findByUser(actor, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: actor.id },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data.map((notification) => notification.id)).toEqual(['notif-1', 'notif-2']);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.pages).toBe(1);
    });

    it('filters by isRead when provided', async () => {
      const actor = buildActor();
      const query: ListNotificationsDto = { page: 1, limit: 10, isRead: false };
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await notificationService.findByUser(actor, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: actor.id, isRead: false } }),
      );
    });

    it('calculates correct page offset on page 2', async () => {
      const actor = buildActor();
      const query: ListNotificationsDto = { page: 2, limit: 10 };
      notificationRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await notificationService.findByUser(actor, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.pages).toBe(3);
    });

    it('bounds the page size to the maximum allowed even if a larger limit is requested', async () => {
      const actor = buildActor();
      const query = { page: 1, limit: 1000 } as ListNotificationsDto;
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await notificationService.findByUser(actor, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('findRecentByUser', () => {
    it('returns the most recent notifications limited by count', async () => {
      const actor = buildActor();
      const recentNotifs = [
        { id: 'notif-1', userId: actor.id, type: NotificationType.SYSTEM, title: 't', message: 'm', isRead: false, metadata: null, createdAt: new Date() },
        { id: 'notif-2', userId: actor.id, type: NotificationType.SYSTEM, title: 't', message: 'm', isRead: false, metadata: null, createdAt: new Date() },
      ];
      notificationRepository.find.mockResolvedValue(recentNotifs);

      const result = await notificationService.findRecentByUser(actor, 5);

      expect(notificationRepository.find).toHaveBeenCalledWith({
        where: { userId: actor.id },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      expect(result.map((notification) => notification.id)).toEqual(['notif-1', 'notif-2']);
    });

    it('uses default limit of 5 when not specified', async () => {
      const actor = buildActor();
      notificationRepository.find.mockResolvedValue([]);

      await notificationService.findRecentByUser(actor);

      expect(notificationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('countUnread', () => {
    it('counts only the actor own unread notifications', async () => {
      const actor = buildActor();
      notificationRepository.count.mockResolvedValue(4);

      const result = await notificationService.countUnread(actor);

      expect(notificationRepository.count).toHaveBeenCalledWith({ where: { userId: actor.id, isRead: false } });
      expect(result).toEqual({ count: 4 });
    });

    it('returns zero when there are no unread notifications', async () => {
      const actor = buildActor();
      notificationRepository.count.mockResolvedValue(0);

      const result = await notificationService.countUnread(actor);

      expect(result).toEqual({ count: 0 });
    });
  });

  describe('markAsRead', () => {
    it('marks an existing notification as read', async () => {
      const actor = buildActor();
      const notificationId = 'notif-uuid-001';
      const notification = { id: notificationId, userId: actor.id, isRead: false };
      const updatedNotification = { ...notification, isRead: true };

      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.save.mockResolvedValue(updatedNotification);

      const result = await notificationService.markAsRead(notificationId, actor);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId: actor.id },
      });
      expect(notificationRepository.save).toHaveBeenCalledWith({ ...notification, isRead: true });
      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      const actor = buildActor();
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('nonexistent-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when notification belongs to another user', async () => {
      const actor = buildActor({ id: 'wrong-user-uuid' });
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('notif-uuid-001', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read for the actor', async () => {
      const actor = buildActor();
      notificationRepository.update.mockResolvedValue({ affected: 3 });

      const result = await notificationService.markAllAsRead(actor);

      expect(notificationRepository.update).toHaveBeenCalledWith(
        { userId: actor.id, isRead: false },
        { isRead: true },
      );
      expect(result).toEqual({ updated: true });
    });
  });

  describe('remove', () => {
    it('removes an existing notification', async () => {
      const actor = buildActor();
      const notificationId = 'notif-uuid-001';
      const notification = { id: notificationId, userId: actor.id };

      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.remove.mockResolvedValue(undefined);

      const result = await notificationService.remove(notificationId, actor);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId: actor.id },
      });
      expect(notificationRepository.remove).toHaveBeenCalledWith(notification);
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when notification does not exist', async () => {
      const actor = buildActor();
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.remove('nonexistent-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
