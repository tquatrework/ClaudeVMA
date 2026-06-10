import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
  ) {}

  create(dto: CreateNotificationDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async findByUser(userId: string, query: ListNotificationsDto) {
    const { page = 1, limit = 20, isRead } = query;
    const where: Record<string, unknown> = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [items, total] = await this.repo.findAndCount({
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
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.repo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException(`Notification ${id} not found`);
    return this.repo.save({ ...notif, isRead: true });
  }

  async markAllAsRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { updated: true };
  }

  async remove(id: string, userId: string) {
    const notif = await this.repo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException(`Notification ${id} not found`);
    await this.repo.remove(notif);
    return { deleted: true };
  }
}
