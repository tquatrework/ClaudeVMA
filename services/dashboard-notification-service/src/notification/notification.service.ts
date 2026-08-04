import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginatedNotificationsResponseDto, PaginationMetaDto } from './dto/paginated-notifications-response.dto';
import { DeleteNotificationResponseDto } from './dto/delete-notification-response.dto';
import { Actor } from '../common/types/actor';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
  ) {}

  /** Use case: create a notification for a target user or role broadcast. */
  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.save(this.notificationRepository.create(dto));
    return NotificationResponseDto.fromEntity(notification);
  }

  /** Use case: list the authenticated actor's own notifications, bounded and ordered. */
  async findByUser(actor: Actor, query: ListNotificationsDto): Promise<PaginatedNotificationsResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, MAX_PAGE_SIZE);
    const where: Record<string, unknown> = { userId: actor.id };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const meta = new PaginationMetaDto();
    meta.total = total;
    meta.page = page;
    meta.limit = limit;
    meta.pages = Math.ceil(total / limit);

    const response = new PaginatedNotificationsResponseDto();
    response.data = items.map((notification) => NotificationResponseDto.fromEntity(notification));
    response.meta = meta;
    return response;
  }

  /** Use case: fetch the actor's most recent notifications, bounded and ordered. */
  async findRecentByUser(actor: Actor, limit = 5): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationRepository.find({
      where: { userId: actor.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return notifications.map((notification) => NotificationResponseDto.fromEntity(notification));
  }

  /** Use case: mark one of the actor's own notifications as read. */
  async markAsRead(id: string, actor: Actor): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.findOne({ where: { id, userId: actor.id } });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    const updated = await this.notificationRepository.save({ ...notification, isRead: true });
    return NotificationResponseDto.fromEntity(updated);
  }

  /**
   * Use case: mark all unread notifications as read for the actor.
   * Not yet wired to a controller route — see docs/services/dashboard-notification-service.md
   * "points en suspens" before exposing it.
   */
  async markAllAsRead(actor: Actor): Promise<{ updated: boolean }> {
    await this.notificationRepository.update({ userId: actor.id, isRead: false }, { isRead: true });
    return { updated: true };
  }

  /** Use case: delete one of the actor's own notifications. */
  async remove(id: string, actor: Actor): Promise<DeleteNotificationResponseDto> {
    const notification = await this.notificationRepository.findOne({ where: { id, userId: actor.id } });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    await this.notificationRepository.remove(notification);
    const response = new DeleteNotificationResponseDto();
    response.deleted = true;
    return response;
  }
}
