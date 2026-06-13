import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
  ) {}

  create(dto: CreateNotificationDto) {
    return this.notificationRepository.save(this.notificationRepository.create(dto));
  }

  async findByUser(userId: string, query: ListNotificationsDto) {
    const { page = 1, limit = 20, isRead } = query;
    const where: Record<string, unknown> = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findRecentByUser(userId: string, limit = 5): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return this.notificationRepository.save({ ...notification, isRead: true });
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
    return { updated: true };
  }

  async remove(id: string, userId: string) {
    const notification = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    await this.notificationRepository.remove(notification);
    return { deleted: true };
  }
}
