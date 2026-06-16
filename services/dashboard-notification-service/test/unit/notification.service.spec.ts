import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from '../../src/notification/notification.service';
import { Notification, NotificationType } from '../../src/notification/entities/notification.entity';
import { CreateNotificationDto } from '../../src/notification/dto/create-notification.dto';
import { ListNotificationsDto } from '../../src/notification/dto/list-notifications.dto';

const mockNotificationRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
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
      const createdNotif = { id: 'notif-001', ...dto, isRead: false, createdAt: new Date() };

      notificationRepository.create.mockReturnValue(createdNotif);
      notificationRepository.save.mockResolvedValue(createdNotif);

      const result = await notificationService.create(dto);

      expect(notificationRepository.create).toHaveBeenCalledWith(dto);
      expect(notificationRepository.save).toHaveBeenCalledWith(createdNotif);
      expect(result).toEqual(createdNotif);
    });
  });

  describe('findByUser', () => {
    it('returns paginated notifications for a user', async () => {
      const userId = 'user-uuid-001';
      const query: ListNotificationsDto = { page: 1, limit: 20 };
      const notifications = [
        { id: 'notif-1', userId, title: 'Notif 1', isRead: false },
        { id: 'notif-2', userId, title: 'Notif 2', isRead: true },
      ];
      notificationRepository.findAndCount.mockResolvedValue([notifications, 2]);

      const result = await notificationService.findByUser(userId, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.data).toEqual(notifications);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.pages).toBe(1);
    });

    it('filters by isRead when provided', async () => {
      const userId = 'user-uuid-001';
      const query: ListNotificationsDto = { page: 1, limit: 10, isRead: false };
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await notificationService.findByUser(userId, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, isRead: false } }),
      );
    });

    it('calculates correct page offset on page 2', async () => {
      const userId = 'user-uuid-001';
      const query: ListNotificationsDto = { page: 2, limit: 10 };
      notificationRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await notificationService.findByUser(userId, query);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta.pages).toBe(3);
    });
  });

  describe('findRecentByUser', () => {
    it('returns the most recent notifications limited by count', async () => {
      const userId = 'user-uuid-001';
      const recentNotifs = [{ id: 'notif-1' }, { id: 'notif-2' }];
      notificationRepository.find.mockResolvedValue(recentNotifs);

      const result = await notificationService.findRecentByUser(userId, 5);

      expect(notificationRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 5,
      });
      expect(result).toEqual(recentNotifs);
    });

    it('uses default limit of 5 when not specified', async () => {
      notificationRepository.find.mockResolvedValue([]);

      await notificationService.findRecentByUser('user-uuid-001');

      expect(notificationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('markAsRead', () => {
    it('marks an existing notification as read', async () => {
      const notificationId = 'notif-uuid-001';
      const userId = 'user-uuid-001';
      const notification = { id: notificationId, userId, isRead: false };
      const updatedNotification = { ...notification, isRead: true };

      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.save.mockResolvedValue(updatedNotification);

      const result = await notificationService.markAsRead(notificationId, userId);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(notificationRepository.save).toHaveBeenCalledWith({ ...notification, isRead: true });
      expect(result.isRead).toBe(true);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('nonexistent-uuid', 'user-uuid-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when notification belongs to another user', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.markAsRead('notif-uuid-001', 'wrong-user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read for a user', async () => {
      const userId = 'user-uuid-001';
      notificationRepository.update.mockResolvedValue({ affected: 3 });

      const result = await notificationService.markAllAsRead(userId);

      expect(notificationRepository.update).toHaveBeenCalledWith(
        { userId, isRead: false },
        { isRead: true },
      );
      expect(result).toEqual({ updated: true });
    });
  });

  describe('remove', () => {
    it('removes an existing notification', async () => {
      const notificationId = 'notif-uuid-001';
      const userId = 'user-uuid-001';
      const notification = { id: notificationId, userId };

      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.remove.mockResolvedValue(undefined);

      const result = await notificationService.remove(notificationId, userId);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, userId },
      });
      expect(notificationRepository.remove).toHaveBeenCalledWith(notification);
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        notificationService.remove('nonexistent-uuid', 'user-uuid-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
