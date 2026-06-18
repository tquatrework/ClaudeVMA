import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenActivity } from './entities/open-activity.entity';
import { ActivityAcceptance } from './entities/activity-acceptance.entity';
import { CreateOpenActivityDto } from './dto/create-open-activity.dto';
import { UpdateOpenActivityDto } from './dto/update-open-activity.dto';
import { SearchOpenActivityDto } from './dto/search-open-activity.dto';
import { AcceptOpenActivityDto } from './dto/accept-open-activity.dto';
import { ActivityStatus } from '../common/enums/activity-status.enum';
import { ActivitySource } from '../common/enums/activity-source.enum';
import { UserRole } from '../common/enums/user-role.enum';

const PUBLISHER_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

const ACCEPTOR_ROLES: string[] = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

const VIEWER_ROLES: string[] = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

const GLOBAL_VIEWER_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/**
 * Serialise une liste d'activités au format CSV.
 * Colonnes : id, title, source, status, rewardType, rewardAmount,
 *            maxAcceptances, currentAcceptances, deadline, publishedById, publishedByRole, createdAt
 */
export function buildActivitiesCsv(activities: OpenActivity[]): string {
  const csvHeader =
    'id,title,source,status,rewardType,rewardAmount,maxAcceptances,currentAcceptances,deadline,publishedById,publishedByRole,createdAt';

  const escapeCsvField = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csvRows = activities.map((activity) =>
    [
      escapeCsvField(activity.id),
      escapeCsvField(activity.title),
      escapeCsvField(activity.source),
      escapeCsvField(activity.status),
      escapeCsvField(activity.rewardType),
      escapeCsvField(activity.rewardAmount),
      escapeCsvField(activity.maxAcceptances),
      escapeCsvField(activity.currentAcceptances),
      escapeCsvField(activity.deadline?.toISOString() ?? ''),
      escapeCsvField(activity.publishedById),
      escapeCsvField(activity.publishedByRole),
      escapeCsvField(activity.createdAt?.toISOString() ?? ''),
    ].join(','),
  );

  return [csvHeader, ...csvRows].join('\n');
}

@Injectable()
export class OpenActivitiesService {
  constructor(
    @InjectRepository(OpenActivity)
    private readonly openActivityRepository: Repository<OpenActivity>,
    @InjectRepository(ActivityAcceptance)
    private readonly acceptanceRepository: Repository<ActivityAcceptance>,
  ) {}

  /**
   * Publish a new open activity.
   * Only RP, AP, TI and AF can publish.
   */
  async create(
    createDto: CreateOpenActivityDto,
    publisherId: string,
    publisherRole: string,
  ): Promise<OpenActivity> {
    if (!PUBLISHER_ROLES.includes(publisherRole)) {
      throw new ForbiddenException('Seuls les RP, AP, TI et AF peuvent publier une activité non pourvue');
    }

    const newActivity = this.openActivityRepository.create({
      title: createDto.title,
      description: createDto.description,
      source: createDto.source ?? ActivitySource.RP_PRODUCTION,
      sourceReferenceId: createDto.sourceReferenceId,
      publishedById: publisherId,
      publishedByRole: publisherRole,
      rewardType: createDto.rewardType,
      rewardAmount: createDto.rewardAmount,
      maxAcceptances: createDto.maxAcceptances ?? 1,
      deadline: createDto.deadline ? new Date(createDto.deadline) : undefined,
      status: ActivityStatus.OPEN,
      currentAcceptances: 0,
    });

    return this.openActivityRepository.save(newActivity);
  }

  /**
   * List open activities with optional filters.
   * Formateurs and AP only see OPEN activities by default.
   */
  async findAll(
    searchParams: SearchOpenActivityDto,
    requesterRole: string,
  ): Promise<{ data: OpenActivity[]; total: number }> {
    if (!VIEWER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès refusé');
    }

    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: Partial<OpenActivity> = {};

    // Formateurs and AP only see open activities unless filtered explicitly
    if (
      requesterRole === UserRole.FORMATEUR ||
      requesterRole === UserRole.ANIMATEUR_PEDAGOGIQUE
    ) {
      whereClause.status = searchParams.status ?? ActivityStatus.OPEN;
    } else if (searchParams.status) {
      whereClause.status = searchParams.status;
    }

    if (searchParams.source) {
      whereClause.source = searchParams.source;
    }

    if (searchParams.publishedById) {
      whereClause.publishedById = searchParams.publishedById;
    }

    const [data, total] = await this.openActivityRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['acceptances'],
    });

    return { data, total };
  }

  /**
   * Get a single open activity by ID.
   */
  async findOne(activityId: string, requesterRole: string): Promise<OpenActivity> {
    if (!VIEWER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès refusé');
    }

    const activity = await this.openActivityRepository.findOne({
      where: { id: activityId },
      relations: ['acceptances'],
    });

    if (!activity) {
      throw new NotFoundException(`Activité ${activityId} introuvable`);
    }

    return activity;
  }

  /**
   * Accept an open activity.
   * Only formateurs and AP can accept.
   * The activity must be OPEN and the quota must not be reached.
   * Once the quota is reached, the activity is automatically closed.
   */
  async accept(
    activityId: string,
    acceptDto: AcceptOpenActivityDto,
    teacherId: string,
    teacherRole: string,
  ): Promise<ActivityAcceptance> {
    if (!ACCEPTOR_ROLES.includes(teacherRole)) {
      throw new ForbiddenException('Seuls les formateurs et AP peuvent accepter une activité');
    }

    const activity = await this.openActivityRepository.findOne({
      where: { id: activityId },
      relations: ['acceptances'],
    });

    if (!activity) {
      throw new NotFoundException(`Activité ${activityId} introuvable`);
    }

    if (activity.status !== ActivityStatus.OPEN) {
      throw new BadRequestException('Cette activité n\'est plus disponible');
    }

    // Check if teacher already accepted this activity
    const existingAcceptance = await this.acceptanceRepository.findOne({
      where: { openActivityId: activityId, teacherId },
    });

    if (existingAcceptance) {
      throw new BadRequestException('Vous avez déjà accepté cette activité');
    }

    const acceptance = this.acceptanceRepository.create({
      openActivityId: activityId,
      teacherId,
      calendarEventId: acceptDto.calendarEventId,
    });

    const savedAcceptance = await this.acceptanceRepository.save(acceptance);

    // Increment counter and close if quota reached
    activity.currentAcceptances += 1;
    if (activity.currentAcceptances >= activity.maxAcceptances) {
      activity.status = ActivityStatus.CLOSED;
    }
    await this.openActivityRepository.save(activity);

    return savedAcceptance;
  }

  /**
   * Update an open activity (status, deadline, quota).
   * Only RP, TI and AF can update.
   */
  async update(
    activityId: string,
    updateDto: UpdateOpenActivityDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<OpenActivity> {
    const allowedRoles: string[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];

    if (!allowedRoles.includes(requesterRole)) {
      throw new ForbiddenException('Seuls les RP, TI et AF peuvent modifier une activité');
    }

    const activity = await this.openActivityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException(`Activité ${activityId} introuvable`);
    }

    if (updateDto.status !== undefined) {
      activity.status = updateDto.status;
    }
    if (updateDto.deadline !== undefined) {
      activity.deadline = new Date(updateDto.deadline);
    }
    if (updateDto.maxAcceptances !== undefined) {
      activity.maxAcceptances = updateDto.maxAcceptances;
    }
    if (updateDto.description !== undefined) {
      activity.description = updateDto.description;
    }

    return this.openActivityRepository.save(activity);
  }

  /**
   * Global activities list (filterable/exportable).
   * Available to RP, TI and AF only.
   */
  async findAllActivities(
    searchParams: SearchOpenActivityDto,
    requesterRole: string,
  ): Promise<{ data: OpenActivity[]; total: number }> {
    if (!GLOBAL_VIEWER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès réservé aux RP, TI et AF');
    }

    const page = searchParams.page ?? 1;
    const limit = searchParams.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: Partial<OpenActivity> = {};

    if (searchParams.status) {
      whereClause.status = searchParams.status;
    }
    if (searchParams.source) {
      whereClause.source = searchParams.source;
    }
    if (searchParams.publishedById) {
      whereClause.publishedById = searchParams.publishedById;
    }

    const [data, total] = await this.openActivityRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['acceptances'],
    });

    return { data, total };
  }
}
