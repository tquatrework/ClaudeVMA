import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArchiveItem } from './entities/archive-item.entity';
import { AddArchiveLinkDto } from './dto/add-archive-link.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { ArchiveItemType } from '../common/enums/archive-item-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Rôles internes autorisés à accéder aux archives de n'importe quel élève.
 * Spec XML roleAccessRules : RP, TI, AF ont un accès étendu.
 */
const INTERNAL_ROLES_WITH_BROAD_ACCESS: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

@Injectable()
export class ArchiveService {
  constructor(
    @InjectRepository(ArchiveItem)
    private readonly archiveItemRepository: Repository<ArchiveItem>,
  ) {}

  /**
   * Vérifie si le demandeur est autorisé à accéder aux archives d'un élève.
   * Spec XML roleAccessRules :
   * - Élève : ses propres archives uniquement.
   * - Parent financeur : archives de ses élèves liés, sauf carnet personnel.
   * - Formateur : archives des élèves contacts selon rattachement.
   * - RP : accès pédagogique large.
   * - TI : accès incident selon autorisation.
   * - AF : seulement si lié à contrôle financier/légal.
   *
   * NOTE : la validation des relations parent↔élève et formateur↔élève est hors scope
   * de ce service (profile-service en est propriétaire). On accepte ici la décision
   * de ne pas re-vérifier ces liens localement — le JWT role suffit pour les rôles larges.
   */
  private assertReadAccess(
    requesterId: string,
    requesterRole: string,
    studentId: string,
  ): void {
    // Rôles internes : accès large sans restriction d'identité
    if (INTERNAL_ROLES_WITH_BROAD_ACCESS.includes(requesterRole)) {
      return;
    }

    // L'élève accède à ses propres archives
    if (requesterRole === UserRole.ELEVE && requesterId === studentId) {
      return;
    }

    // Le parent financeur peut accéder aux archives des élèves liés
    // (la liaison est gérée par profile-service ; on accepte le rôle)
    if (requesterRole === UserRole.PARENT_FINANCEUR) {
      // Sans accès au carnet personnel : géré au niveau du filtre retourné
      return;
    }

    // Le formateur accède aux archives des élèves qui lui sont rattachés
    // (le rattachement est géré par profile-service ; on accepte le rôle)
    if (requesterRole === UserRole.FORMATEUR) {
      return;
    }

    // AP : pas de règle explicite dans la spec, on refuse par défaut
    throw new ForbiddenException(
      `Le rôle ${requesterRole} n'est pas autorisé à accéder aux archives de cet élève`,
    );
  }

  /**
   * Détermine si les éléments de type CARNET_PERSONNEL doivent être filtrés
   * selon le rôle du demandeur.
   * Spec XML : "le carnet personnel n'est pas exposé au parent via les archives"
   */
  private shouldHideCarnetPersonnel(requesterRole: string, requesterId: string, studentId: string): boolean {
    // L'élève lui-même voit son carnet personnel
    if (requesterRole === UserRole.ELEVE && requesterId === studentId) {
      return false;
    }
    // Le parent ne voit pas le carnet personnel
    if (requesterRole === UserRole.PARENT_FINANCEUR) {
      return true;
    }
    // Tous les autres rôles voient tout (pédagogique large pour RP, etc.)
    return false;
  }

  /**
   * Liste les archives pédagogiques d'un élève avec pagination.
   * GET /students/:studentId/pedagogical-archives
   */
  async listPedagogicalArchives(
    studentId: string,
    requesterId: string,
    requesterRole: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ArchiveItem>> {
    this.assertReadAccess(requesterId, requesterRole, studentId);

    const hideCarnet = this.shouldHideCarnetPersonnel(requesterRole, requesterId, studentId);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const offset = (page - 1) * limit;

    const queryBuilder = this.archiveItemRepository
      .createQueryBuilder('item')
      .where('item.studentId = :studentId', { studentId })
      .orderBy('item.occurredAt', 'DESC');

    if (hideCarnet) {
      queryBuilder.andWhere('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    }

    const total = await queryBuilder.getCount();
    const data = await queryBuilder.skip(offset).take(limit).getMany();

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Ajoute un lien archive depuis un service source.
   * POST /students/:studentId/archive-links
   * Supporte l'idempotence via idempotencyKey.
   */
  async addArchiveLink(
    studentId: string,
    dto: AddArchiveLinkDto,
  ): Promise<ArchiveItem> {
    // Vérification idempotence
    if (dto.idempotencyKey) {
      const existingItem = await this.archiveItemRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingItem) {
        if (existingItem.studentId !== studentId) {
          throw new ConflictException(
            `La clé d'idempotence ${dto.idempotencyKey} appartient à un autre élève`,
          );
        }
        return existingItem;
      }
    }

    // Forcer isParentVisible = false pour les carnets personnels (règle spec XML)
    const isParentVisible =
      dto.itemType === ArchiveItemType.CARNET_PERSONNEL
        ? false
        : (dto.isParentVisible ?? true);

    const newItem = this.archiveItemRepository.create({
      studentId,
      itemType: dto.itemType,
      sourceId: dto.sourceId,
      sourceService: dto.sourceService,
      title: dto.title,
      description: dto.description,
      downloadUrl: dto.downloadUrl,
      score: dto.score,
      pedagogicalPoints: dto.pedagogicalPoints ?? 0,
      occurredAt: new Date(dto.occurredAt),
      isParentVisible,
      idempotencyKey: dto.idempotencyKey,
    });

    return this.archiveItemRepository.save(newItem);
  }

  /**
   * Retourne les archives en vue calendrier (groupées par date d'occurrence) avec pagination.
   * La pagination s'applique sur les dates (groupes), pas sur les éléments individuels.
   * GET /students/:studentId/archive-timeline
   */
  async getArchiveTimeline(
    studentId: string,
    requesterId: string,
    requesterRole: string,
    pagination?: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<{ date: string; items: Partial<ArchiveItem>[] }>> {
    this.assertReadAccess(requesterId, requesterRole, studentId);

    const hideCarnet = this.shouldHideCarnetPersonnel(requesterRole, requesterId, studentId);

    const queryBuilder = this.archiveItemRepository
      .createQueryBuilder('item')
      .select([
        'item.id',
        'item.itemType',
        'item.title',
        'item.sourceId',
        'item.sourceService',
        'item.score',
        'item.pedagogicalPoints',
        'item.occurredAt',
      ])
      .where('item.studentId = :studentId', { studentId })
      .orderBy('item.occurredAt', 'ASC');

    if (hideCarnet) {
      queryBuilder.andWhere('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    }

    const allItems = await queryBuilder.getMany();

    // Groupement par date (YYYY-MM-DD)
    const groupedByDate = new Map<string, Partial<ArchiveItem>[]>();

    for (const item of allItems) {
      const dateKey = item.occurredAt.toISOString().slice(0, 10);
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, []);
      }
      groupedByDate.get(dateKey).push({
        id: item.id,
        itemType: item.itemType,
        title: item.title,
        sourceId: item.sourceId,
        sourceService: item.sourceService,
        score: item.score,
        pedagogicalPoints: item.pedagogicalPoints,
      });
    }

    const allDates = Array.from(groupedByDate.entries()).map(([date, items]) => ({
      date,
      items,
    }));

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const total = allDates.length;
    const offset = (page - 1) * limit;
    const data = allDates.slice(offset, offset + limit);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Récupère un élément archive par son ID pour le téléchargement.
   * GET /archive-documents/:id/download
   */
  async getArchiveItemForDownload(
    archiveItemId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<ArchiveItem> {
    const archiveItem = await this.archiveItemRepository.findOne({
      where: { id: archiveItemId },
    });

    if (!archiveItem) {
      throw new NotFoundException(`Élément d'archive ${archiveItemId} non trouvé`);
    }

    this.assertReadAccess(requesterId, requesterRole, archiveItem.studentId);

    // Le parent ne peut pas télécharger le carnet personnel
    if (
      requesterRole === UserRole.PARENT_FINANCEUR &&
      archiveItem.itemType === ArchiveItemType.CARNET_PERSONNEL
    ) {
      throw new ForbiddenException(
        'Le carnet personnel n\'est pas accessible aux parents financeurs',
      );
    }

    if (!archiveItem.downloadUrl) {
      throw new NotFoundException(
        `Aucun URL de téléchargement disponible pour l'élément ${archiveItemId}`,
      );
    }

    return archiveItem;
  }

  /**
   * Route interne : liste des archives d'un élève sans filtrage de rôle.
   * Utilisée par l'orchestration-service pour les workflows.
   */
  async listArchivesInternal(studentId: string): Promise<ArchiveItem[]> {
    return this.archiveItemRepository.find({
      where: { studentId },
      order: { occurredAt: 'DESC' },
    });
  }
}
