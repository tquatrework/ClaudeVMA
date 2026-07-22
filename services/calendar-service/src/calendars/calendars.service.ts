import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class CalendarsService {
  constructor(
    @InjectRepository(Calendar)
    private readonly calendarRepo: Repository<Calendar>,
    @InjectRepository(AvailabilitySlot)
    private readonly slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(PaymentScheduleEntry)
    private readonly paymentRepo: Repository<PaymentScheduleEntry>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Get a calendar by ownerId, creating it lazily if it doesn't exist.
   * CAL-FB-001: requester must own the calendar or have RP/AP/TI privileges.
   */
  async getCalendar(
    ownerId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<Calendar & { paymentEntries?: PaymentScheduleEntry[] }> {
    this.assertCanReadCalendar(ownerId, actor);

    let calendar = await this.calendarRepo.findOne({
      where: { ownerId },
      relations: ['availabilitySlots'],
    });

    if (!calendar) {
      // Lazily create the calendar for this user
      calendar = await this.calendarRepo.save(
        this.calendarRepo.create({ ownerId, ownerRole: actor.role }),
      );
      calendar.availabilitySlots = [];
    }

    // For financeurs, also return payment schedule
    if (actor.role === UserRole.PARENT_FINANCEUR) {
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
   * The lazy calendar creation, slot deletion and slot insertion are atomic
   * (single DataSource transaction / single EntityManager).
   */
  async updateAvailability(
    ownerId: string,
    dto: UpdateAvailabilityDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<Calendar> {
    this.assertCanWriteCalendar(ownerId, actor);

    let slotCount = 0;

    const calendar = await this.dataSource.transaction(async (manager) => {
      const calendarRepo = manager.getRepository(Calendar);
      const slotRepo = manager.getRepository(AvailabilitySlot);

      let existingCalendar = await calendarRepo.findOne({
        where: { ownerId },
        relations: ['availabilitySlots'],
      });

      if (!existingCalendar) {
        existingCalendar = await calendarRepo.save(
          calendarRepo.create({ ownerId, ownerRole: actor.role }),
        );
      }

      // Delete existing slots and replace with new ones
      await slotRepo.delete({ calendarId: existingCalendar.id });

      const newSlots = dto.slots.map((slotDto) =>
        slotRepo.create({
          calendarId: existingCalendar.id,
          dayOfWeek: slotDto.dayOfWeek ?? null,
          startTime: new Date(slotDto.startTime),
          endTime: new Date(slotDto.endTime),
          recurrence: slotDto.recurrence,
        }),
      );

      await slotRepo.save(newSlots);
      slotCount = newSlots.length;

      return calendarRepo.findOne({
        where: { ownerId },
        relations: ['availabilitySlots'],
      });
    });

    // Published after commit — the transaction above has already resolved.
    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotCount },
      correlationId,
    );

    return calendar;
  }

  // ---- Access control helpers ----

  /**
   * CAL-FB-001: Read access — owner or internal roles (RP, AP, TI, FINANCE_ADMIN).
   */
  private assertCanReadCalendar(ownerId: string, actor: AuthenticatedUser): void {
    const internalRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (actor.id === ownerId) return;
    if (internalRoles.includes(actor.role)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only read your own calendar unless you have an internal role',
    );
  }

  /**
   * CAL-FB-001: Write access — only the owner or RP/TI can modify a calendar.
   */
  private assertCanWriteCalendar(ownerId: string, actor: AuthenticatedUser): void {
    const writeRoles: UserRole[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (actor.id === ownerId) return;
    if (writeRoles.includes(actor.role)) return;
    throw new ForbiddenException(
      'CAL-FB-001: You may only modify your own calendar',
    );
  }
}
