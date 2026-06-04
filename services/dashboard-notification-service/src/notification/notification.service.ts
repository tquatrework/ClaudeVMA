import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
  ) {}

  create(dto: CreateNotificationDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findByUser(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async markAsRead(id: string) {
    const notif = await this.repo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notification ${id} not found`);
    return this.repo.save({ ...notif, isRead: true });
  }

  async markAllAsRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
    return { updated: true };
  }

  async remove(id: string) {
    const notif = await this.repo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notification ${id} not found`);
    await this.repo.remove(notif);
    return { deleted: true };
  }
}
