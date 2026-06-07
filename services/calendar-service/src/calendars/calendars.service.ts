import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class CalendarsService {
  constructor(
    @InjectRepository(Calendar)
    private readonly calendarRepo: Repository<Calendar>,
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(PaymentScheduleEntry)
    private readonly paymentRepo: Repository<PaymentScheduleEntry>,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Get a calendar by ownerId, creating it lazily if it doesn't exist.
   * CAL-FB-001: requester must own the calendar or have RP/AP/TI privileges.
   */
  async getCalendar(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
    correlationId?: string,
  ): Promise<Calendar & { paymentEntries?: PaymentScheduleEntry[] }> {
    this.assertCanReadCalendar(ownerId, requesterId, requesterRole);

    let calendar = await this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });

    if (!calendar) {
      // Lazily create the calendar for this user
      calendar = await this.calendarRepo.save(
        this.calendarRepo.create({ ownerId, ownerRole: requesterRole }),
      );
      calendar.availabilitySlots = [];
    }

    // For financeurs, also return payment schedule
    if (requesterRole === UserRole.PARENT_FINANCEUR) {
      const paymentEntries = await this.paymentRepo.find({
        where: { ownerId },
        order: { dueDate: 'ASC' },
      });
      return { ...calendar, paymentEntries };
    }

    return calendar;
  }

  /**
   * Replace availability slots for an owner (CAL-BR-001, CAL-BR-002).
   * CAL-FB-001: only the owner or RP/TI can update.
   */
  async updateAvailability(
    ownerId: string,
    dto: UpdateAvailabilityDto,
    requesterId: string,
    requesterRole: string,
    correlationId?: string,
  ): Promise<Calendar> {
    this.assertCanWriteCalendar(ownerId, requesterId, requesterRole);

    let calendar = await this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });

    if (!calendar) {
      calendar = await this.calendarRepo.save(
        this.calendarRepo.create({ ownerId, ownerRole: requesterRole }),
      );
    }

    // Delete existing slots and replace with new ones
    await this.slotRepo.delete({ calendarId: calendar.id });

    const newSlots = dto.slots.map((s) =>
      this.slotRepo.create({
        calendarId: calendar.id,
        dayOfWeek: s.dayOfWeek ?? null,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        recurrence: s.recurrence,
      }),
    );

    await this.slotRepo.save(newSlots);

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotCount: newSlots.length },
      correlationId,
    );

    return this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });
  }

  // ---- Access control helpers ----

  /**
   * CAL-FB-001: Read access — owner or internal roles (RP, AP, TI, FINANCE_ADMIN).
   */
  private assertCanReadCalendar(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
  ): void {
    const internalRoles: string[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (requesterId === ownerId) return;
    if (internalRoles.includes(requesterRole)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only read your own calendar unless you have an internal role',
    );
  }

  /**
   * CAL-FB-001: Write access — only the owner or RP/TI can modify a calendar.
   */
  private assertCanWriteCalendar(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
  ): void {
    const writeRoles: string[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (requesterId === ownerId) return;
    if (writeRoles.includes(requesterRole)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only modify your own calendar',
    );
  }
}
