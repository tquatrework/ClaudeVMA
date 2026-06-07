import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledActivity, ActivityType } from './entities/scheduled-activity.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(ScheduledActivity)
    private readonly activityRepo: Repository<ScheduledActivity>,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Create a scheduled activity.
   * CAL-BR-007: student(s) may be participants.
   * CAL-BR-008: AP or RP can propose activities to teachers.
   * CAL-FB-002: at least one participant and a valid time range required.
   * CAL-FB-003: AP can only propose pedagogical meetings.
   */
  async create(
    dto: CreateActivityDto,
    creatorId: string,
    creatorRole: string,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    this.validateActivityCreation(dto, creatorRole);

    const activity = await this.activityRepo.save(
      this.activityRepo.create({
        title: dto.title,
        type: dto.type,
        creatorId,
        creatorRole,
        participantIds: dto.participantIds,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        description: dto.description ?? null,
        correlationId: dto.correlationId ?? correlationId ?? null,
      }),
    );

    this.eventsService.publish(
      'ActivityScheduled',
      {
        activityId: activity.id,
        type: activity.type,
        creatorId,
        participantIds: activity.participantIds,
        startTime: activity.startTime,
      },
      correlationId ?? dto.correlationId,
    );

    return activity;
  }

  /**
   * Update a scheduled activity (CAL-BR-010: publishes ActivityUpdated).
   * CAL-FB-001: only creator, RP, or TI can update.
   */
  async update(
    activityId: string,
    dto: UpdateActivityDto,
    requesterId: string,
    requesterRole: string,
    correlationId?: string,
  ): Promise<ScheduledActivity> {
    const activity = await this.findOneOrFail(activityId);
    this.assertCanModifyActivity(activity, requesterId, requesterRole);

    // CAL-FB-002: if participantIds updated, must remain non-empty (validated by DTO)
    const updated = await this.activityRepo.save({
      ...activity,
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : activity.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : activity.endTime,
      correlationId: dto.correlationId ?? activity.correlationId,
    });

    this.eventsService.publish(
      'ActivityUpdated',
      {
        activityId: updated.id,
        changes: Object.keys(dto),
        updatedBy: requesterId,
      },
      correlationId ?? dto.correlationId,
    );

    return updated;
  }

  async findOne(activityId: string): Promise<ScheduledActivity> {
    return this.findOneOrFail(activityId);
  }

  async findByParticipant(userId: string): Promise<ScheduledActivity[]> {
    // simple-json column: use query builder for portability
    return this.activityRepo
      .createQueryBuilder('a')
      .where("a.participant_ids LIKE :uid", { uid: `%${userId}%` })
      .orderBy('a.start_time', 'ASC')
      .getMany();
  }

  // ---- Private helpers ----

  private async findOneOrFail(activityId: string): Promise<ScheduledActivity> {
    const a = await this.activityRepo.findOne({ where: { id: activityId } });
    if (!a) throw new NotFoundException(`Activity ${activityId} not found`);
    return a;
  }

  /**
   * CAL-FB-002: Validate that business constraints on creation are met.
   * CAL-FB-003: AP can only propose pedagogical meetings to teachers in their scope
   *   (scope enforcement is caller-side for Phase 1; the type constraint is enforced here).
   */
  private validateActivityCreation(dto: CreateActivityDto, creatorRole: string): void {
    if (dto.participantIds.length === 0) {
      throw new BadRequestException('CAL-FB-002: At least one participant is required');
    }

    // CAL-FB-003: AP can only create REUNION_PEDAGOGIQUE
    if (
      creatorRole === UserRole.ANIMATEUR_PEDAGOGIQUE &&
      dto.type !== ActivityType.REUNION_PEDAGOGIQUE
    ) {
      throw new ForbiddenException(
        'CAL-FB-003: AP can only create pedagogical meetings (reunion_pedagogique)',
      );
    }
  }

  /**
   * CAL-FB-001: Only creator, RP, or TI can update an activity.
   */
  private assertCanModifyActivity(
    activity: ScheduledActivity,
    requesterId: string,
    requesterRole: string,
  ): void {
    const writeRoles: string[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (activity.creatorId === requesterId) return;
    if (writeRoles.includes(requesterRole)) return;
    throw new ForbiddenException(
      'CAL-FB-001: Only the creator, RP, or TI can modify this activity',
    );
  }
}
