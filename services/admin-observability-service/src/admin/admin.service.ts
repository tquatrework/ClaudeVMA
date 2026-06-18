import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { TechnicalLog } from './entities/technical-log.entity';
import { VisibilityOverride } from './entities/visibility-override.entity';
import { SiteMetadata } from './entities/site-metadata.entity';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { QueryTechnicalLogDto } from './dto/query-technical-log.dto';
import { CreateVisibilityOverrideDto } from './dto/create-visibility-override.dto';
import { UpdateSiteMetadataDto } from './dto/update-site-metadata.dto';
import { UserRole } from '../common/enums/user-role.enum';

/** Roles allowed to read technical logs (TI only) */
const TECHNICAL_LOG_READER_ROLES: string[] = [
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** Roles allowed to read activity logs */
const ACTIVITY_LOG_READER_ROLES: string[] = [
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/** Roles allowed to create/lift visibility overrides */
const VISIBILITY_OVERRIDE_MANAGER_ROLES: string[] = [
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/** Roles allowed to modify site metadata */
const SITE_METADATA_EDITOR_ROLES: string[] = [
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/**
 * AF cannot be self-assigned by TI (AOS-BR-002).
 * This constant lists roles that TI cannot self-grant.
 */
const FORBIDDEN_SELF_GRANT_ROLES: string[] = [
  UserRole.ADMINISTRATEUR_FINANCIER,
];

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(TechnicalLog)
    private readonly technicalLogRepository: Repository<TechnicalLog>,
    @InjectRepository(VisibilityOverride)
    private readonly visibilityOverrideRepository: Repository<VisibilityOverride>,
    @InjectRepository(SiteMetadata)
    private readonly siteMetadataRepository: Repository<SiteMetadata>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Activity Logs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List activity logs with optional filters.
   * Accessible to TI, RP and AF.
   */
  async findActivityLogs(
    queryDto: QueryActivityLogDto,
    requesterRole: string,
  ): Promise<{ data: ActivityLog[]; total: number }> {
    if (!ACTIVITY_LOG_READER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès réservé aux TI, RP et AF');
    }

    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: Partial<ActivityLog> = {};
    if (queryDto.operatorRole) {
      whereClause.operatorRole = queryDto.operatorRole;
    }
    if (queryDto.resourceType) {
      whereClause.resourceType = queryDto.resourceType;
    }
    if (queryDto.resourceId) {
      whereClause.resourceId = queryDto.resourceId;
    }

    const [data, total] = await this.activityLogRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Technical Logs
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Read technical logs.
   * Accessible to TI only.
   */
  async findTechnicalLogs(
    queryDto: QueryTechnicalLogDto,
    requesterRole: string,
  ): Promise<{ data: TechnicalLog[]; total: number }> {
    if (!TECHNICAL_LOG_READER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès réservé au TI');
    }

    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: Partial<TechnicalLog> = {};
    if (queryDto.level) {
      whereClause.level = queryDto.level;
    }
    if (queryDto.service) {
      whereClause.service = queryDto.service;
    }

    const [data, total] = await this.technicalLogRepository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility Overrides
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a visibility override (temporarily hide an element).
   * AOS-BR-001: A hidden element is NOT deleted.
   * Only TI can create overrides.
   */
  async createVisibilityOverride(
    createDto: CreateVisibilityOverrideDto,
    operatorId: string,
    operatorRole: string,
  ): Promise<VisibilityOverride> {
    if (!VISIBILITY_OVERRIDE_MANAGER_ROLES.includes(operatorRole)) {
      throw new ForbiddenException('Seul le TI peut créer un masquage temporaire');
    }

    const existingActiveOverride = await this.visibilityOverrideRepository.findOne({
      where: {
        resourceType: createDto.resourceType,
        resourceId: createDto.resourceId,
        isActive: true,
      },
    });

    if (existingActiveOverride) {
      throw new BadRequestException(
        'Un masquage actif existe déjà pour cette ressource',
      );
    }

    const override = this.visibilityOverrideRepository.create({
      resourceType: createDto.resourceType,
      resourceId: createDto.resourceId,
      reason: createDto.reason,
      createdById: operatorId,
      createdByRole: operatorRole,
      isActive: true,
    });

    return this.visibilityOverrideRepository.save(override);
  }

  /**
   * Lift a visibility override (restore visibility of an element).
   * AOS-BR-001: Lifting an override does NOT delete the original resource.
   * Only TI can lift overrides.
   */
  async liftVisibilityOverride(
    overrideId: string,
    operatorId: string,
    operatorRole: string,
  ): Promise<VisibilityOverride> {
    if (!VISIBILITY_OVERRIDE_MANAGER_ROLES.includes(operatorRole)) {
      throw new ForbiddenException('Seul le TI peut lever un masquage temporaire');
    }

    const override = await this.visibilityOverrideRepository.findOne({
      where: { id: overrideId },
    });

    if (!override) {
      throw new NotFoundException(`Masquage ${overrideId} introuvable`);
    }

    if (!override.isActive) {
      throw new BadRequestException('Ce masquage est déjà levé');
    }

    override.isActive = false;
    override.liftedById = operatorId;
    override.liftedAt = new Date();

    return this.visibilityOverrideRepository.save(override);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Site Metadata
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update site metadata (URLs, SEO metas, etc.).
   * Only TI can modify metadata.
   * AOS-BR-003: All admin actions preserve the real operator identity.
   */
  async updateSiteMetadata(
    metadataId: string,
    updateDto: UpdateSiteMetadataDto,
    operatorId: string,
    operatorRole: string,
  ): Promise<SiteMetadata> {
    if (!SITE_METADATA_EDITOR_ROLES.includes(operatorRole)) {
      throw new ForbiddenException('Seul le TI peut modifier les métadonnées du site');
    }

    const siteMetadata = await this.siteMetadataRepository.findOne({
      where: { id: metadataId },
    });

    if (!siteMetadata) {
      throw new NotFoundException(`Métadonnée ${metadataId} introuvable`);
    }

    siteMetadata.metaValue = updateDto.metaValue;
    if (updateDto.description !== undefined) {
      siteMetadata.description = updateDto.description;
    }
    // AOS-BR-003: always preserve the real operator identity
    siteMetadata.lastModifiedById = operatorId;
    siteMetadata.lastModifiedByRole = operatorRole;

    return this.siteMetadataRepository.save(siteMetadata);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health Metrics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return basic availability/performance indicators.
   * AOS-BR-004: Non-functional indicators must be consultable.
   * Accessible to TI, RP and AF.
   */
  async getHealthMetrics(
    requesterRole: string,
  ): Promise<{ status: string; availabilityTarget: string; performanceTarget: string; timestamp: string }> {
    if (!ACTIVITY_LOG_READER_ROLES.includes(requesterRole)) {
      throw new ForbiddenException('Accès réservé aux TI, RP et AF');
    }

    return {
      status: 'ok',
      availabilityTarget: '99%',
      performanceTarget: '<2s',
      timestamp: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Admin Action Audit
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Log a sensitive admin action.
   * AOS-BR-003: All sensitive admin actions keep the real operator identity.
   * AOS-BR-002: TI cannot self-grant AF role.
   */
  async logAdminAction(
    operatorId: string,
    operatorRole: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: string,
    correlationId?: string,
    ipAddress?: string,
  ): Promise<ActivityLog> {
    // AOS-BR-002: TI cannot self-grant AF access
    if (
      operatorRole === UserRole.TECHNICIEN_INFORMATIQUE &&
      FORBIDDEN_SELF_GRANT_ROLES.some((forbiddenRole) => action.includes(forbiddenRole))
    ) {
      throw new ForbiddenException(
        'Le TI ne peut pas s\'auto-attribuer les droits AF',
      );
    }

    const logEntry = this.activityLogRepository.create({
      operatorId,
      operatorRole,
      action,
      resourceType,
      resourceId,
      details,
      correlationId,
      ipAddress,
    });

    return this.activityLogRepository.save(logEntry);
  }
}
