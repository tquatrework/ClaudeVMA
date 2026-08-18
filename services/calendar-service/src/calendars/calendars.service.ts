import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Calendar } from './entities/calendar.entity';
import { AvailabilitySlot, SlotKind, SlotRecurrence } from './entities/availability-slot.entity';
import { PaymentScheduleEntry } from './entities/payment-schedule-entry.entity';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
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

  /**
   * Create a single availability slot (CAL-BR-001/CAL-BR-002), without
   * touching any other existing slot — unlike `updateAvailability`, which
   * replaces the whole set.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async createSlot(
    ownerId: string,
    dto: CreateAvailabilitySlotDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<AvailabilitySlot> {
    this.assertCanWriteCalendar(ownerId, actor);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const recurrenceEndDate = dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null;
    this.assertValidSlotTimes(startTime, endTime, recurrenceEndDate);

    const slot = await this.dataSource.transaction(async (manager) => {
      const calendarRepo = manager.getRepository(Calendar);
      const slotRepo = manager.getRepository(AvailabilitySlot);

      let calendar = await calendarRepo.findOne({ where: { ownerId } });
      if (!calendar) {
        calendar = await calendarRepo.save(
          calendarRepo.create({ ownerId, ownerRole: actor.role }),
        );
      }

      return slotRepo.save(
        slotRepo.create({
          calendarId: calendar.id,
          dayOfWeek: dto.dayOfWeek ?? null,
          startTime,
          endTime,
          recurrence: dto.recurrence ?? SlotRecurrence.NONE,
          recurrenceEndDate,
          kind: dto.kind ?? SlotKind.AVAILABLE,
        }),
      );
    });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: slot.id, action: 'created' },
      correlationId,
    );

    return slot;
  }

  /**
   * Update a single availability slot: resize (startTime/endTime), change
   * recurrence/end date/kind. Scoped to `ownerId` — a `slotId` that exists
   * but belongs to a different owner's calendar is treated as not found,
   * never modified and never revealed.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async updateSlot(
    ownerId: string,
    slotId: string,
    dto: UpdateAvailabilitySlotDto,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<AvailabilitySlot> {
    this.assertCanWriteCalendar(ownerId, actor);

    const slot = await this.findSlotOrFail(ownerId, slotId);

    const startTime = dto.startTime ? new Date(dto.startTime) : slot.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : slot.endTime;
    const recurrenceEndDate =
      dto.recurrenceEndDate === undefined
        ? slot.recurrenceEndDate
        : dto.recurrenceEndDate === null
          ? null
          : new Date(dto.recurrenceEndDate);
    this.assertValidSlotTimes(startTime, endTime, recurrenceEndDate);

    const updated = await this.slotRepo.save({
      ...slot,
      dayOfWeek: dto.dayOfWeek ?? slot.dayOfWeek,
      startTime,
      endTime,
      recurrence: dto.recurrence ?? slot.recurrence,
      recurrenceEndDate,
      kind: dto.kind ?? slot.kind,
    });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: updated.id, action: 'updated' },
      correlationId,
    );

    return updated;
  }

  /**
   * Delete a single availability slot. Hard delete — consistent with the
   * existing bulk-replace behaviour of `updateAvailability`, which already
   * deletes and recreates slots wholesale; this is operational scheduling
   * data, not a record with probative/audit value.
   * CAL-FB-001: only the owner or RP/TI can write.
   */
  async deleteSlot(
    ownerId: string,
    slotId: string,
    actor: AuthenticatedUser,
    correlationId?: string,
  ): Promise<void> {
    this.assertCanWriteCalendar(ownerId, actor);

    const slot = await this.findSlotOrFail(ownerId, slotId);
    await this.slotRepo.delete({ id: slot.id });

    this.eventsService.publish(
      'AvailabilityUpdated',
      { ownerId, slotId: slot.id, action: 'deleted' },
      correlationId,
    );
  }

  // ---- Slot helpers ----

  /**
   * Loads a slot scoped to its owner's calendar. A `slotId` that exists but
   * belongs to another owner's calendar is treated exactly like an unknown
   * slot — no existence leak (same posture as other masking rules in this
   * project).
   */
  private async findSlotOrFail(ownerId: string, slotId: string): Promise<AvailabilitySlot> {
    const slot = await this.slotRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.calendar', 'calendar')
      .where('slot.id = :slotId', { slotId })
      .andWhere('calendar.owner_id = :ownerId', { ownerId })
      .getOne();

    if (!slot) {
      throw new NotFoundException(`Availability slot ${slotId} not found`);
    }
    return slot;
  }

  private assertValidSlotTimes(
    startTime: Date,
    endTime: Date,
    recurrenceEndDate: Date | null,
  ): void {
    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (recurrenceEndDate && recurrenceEndDate.getTime() < startTime.getTime()) {
      throw new BadRequestException('recurrenceEndDate must not be before startTime');
    }
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
