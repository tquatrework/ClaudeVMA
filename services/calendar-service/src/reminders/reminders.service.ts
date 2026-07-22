import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { EventsService } from '../events/events.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Create a reminder for a user (CAL-BR-004: RP can create reminders).
   * CAL-BR-010: publishes ReminderCreated event.
   */
  async create(
    dto: CreateReminderDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<Reminder> {
    const reminder = await this.reminderRepo.save(
      this.reminderRepo.create({
        ownerId: dto.ownerId,
        ownerRole: dto.ownerRole,
        activityId: dto.activityId ?? null,
        message: dto.message,
        remindAt: new Date(dto.remindAt),
      }),
    );

    this.eventsService.publish(
      'ReminderCreated',
      {
        reminderId: reminder.id,
        ownerId: reminder.ownerId,
        activityId: reminder.activityId,
        remindAt: reminder.remindAt,
        createdBy: actor.id,
      },
      correlationId,
    );

    return reminder;
  }

  async findByOwner(ownerId: string): Promise<Reminder[]> {
    return this.reminderRepo.find({
      where: { ownerId },
      order: { remindAt: 'ASC' },
    });
  }
}
