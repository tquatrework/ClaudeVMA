import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArchiveItem } from './entities/archive-item.entity';
import { AddArchiveLinkDto } from './dto/add-archive-link.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { ArchiveItemType } from '../common/enums/archive-item-type.enum';
import { UserRole } from '../common/enums/user-role.enum';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../common/clients/profile-relations.client';
import {
  ArchiveViewerPosition,
  isArchiveReadAllowed,
  resolveArchiveViewerPosition,
} from './pedagogical-archive-access.policy';

/**
 * Rôles autorisés à créer un lien archive pour un élève via cette route HTTP.
 * La route POST /archives/students/:studentId/archive-links est réservée aux
 * services sources (formateurs) et aux rôles internes.
 *
 * Ceci reste une liste de rôles, à dessein : c'est une ÉCRITURE. Une relation
 * ouvre la lecture, jamais l'écriture (arbitrage du 2026-08-07).
 */
const ROLES_ALLOWED_TO_WRITE_ARCHIVES: string[] = [
  UserRole.FORMATEUR,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/**
 * Message UNIQUE couvrant à la fois « aucune archive » et « aucun droit ».
 *
 * Arbitrage du 2026-08-11, point 5 : un accès refusé faute de relation ne doit
 * pas révéler l'existence de ce qu'on refuse de montrer. Les deux cas sont donc
 * volontairement indiscernables — même statut 404, même message, et aucun
 * identifiant technique dans le texte (arbitrage du 2026-08-09 : aucun UUID
 * sous les yeux d'un utilisateur).
 */
const NO_ARCHIVE_MESSAGE = 'Aucune archive pédagogique accessible pour cette personne';

@Injectable()
export class ArchiveService {
  constructor(
    @InjectRepository(ArchiveItem)
    private readonly archiveItemRepository: Repository<ArchiveItem>,
    private readonly profileRelationsClient: ProfileRelationsClient,
  ) {}

  /**
   * Détermine la position du demandeur vis-à-vis des archives d'une personne,
   * en demandant les relations à `profile-service` — unique propriétaire de ces
   * liens, dont ce service ne tient aucune copie.
   *
   * Le contrôle a lieu AVANT toute lecture en base : une requête refusée ne
   * doit pas même toucher les données qu'elle n'a pas le droit de voir.
   *
   * @throws NotFoundException  si aucune relation n'ouvre le droit (404, jamais 403)
   * @throws ServiceUnavailableException si `profile-service` est injoignable —
   *   on échoue bruyamment plutôt que de deviner : ouvrir par défaut livrerait
   *   l'archive à un inconnu, fermer par défaut la retirerait à son titulaire.
   */
  private async resolveViewerPosition(
    requesterId: string,
    requesterRole: string,
    archiveOwnerId: string,
    correlationId?: string,
  ): Promise<ArchiveViewerPosition> {
    let position: ArchiveViewerPosition;
    try {
      const snapshot = await this.profileRelationsClient.resolveRelations(
        requesterId,
        archiveOwnerId,
        requesterRole,
        correlationId,
      );
      position = resolveArchiveViewerPosition(snapshot);
    } catch (error) {
      if (error instanceof ProfileRelationsUnavailableError) {
        throw new ServiceUnavailableException(
          'Impossible de vérifier les droits d\'accès aux archives pour le moment. Réessayez dans un instant.',
        );
      }
      throw error;
    }

    if (!isArchiveReadAllowed(position)) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }
    return position;
  }

  /**
   * Détermine si les éléments de type CARNET_PERSONNEL doivent être filtrés.
   * Spec XML : « le carnet personnel n'est pas exposé au parent via les archives ».
   *
   * Le titulaire ne se masque jamais rien ; le parent financeur ne voit jamais
   * le carnet personnel, quel que soit son lien.
   */
  private shouldHideCarnetPersonnel(
    position: ArchiveViewerPosition,
    requesterRole: string,
  ): boolean {
    if (position === 'owner') return false;
    return requesterRole === UserRole.PARENT_FINANCEUR;
  }

  /**
   * Liste les archives pédagogiques d'une personne avec pagination.
   * GET /archives/students/:studentId/pedagogical-archives
   *
   * Un titulaire sans aucune archive reçoit un 404 portant le même message
   * qu'un refus : c'est ce qui rend les deux cas indiscernables. La pagination
   * hors bornes, elle, reste un 200 avec une page vide — il y a bien des
   * archives, la page demandée n'existe simplement pas.
   */
  async listPedagogicalArchives(
    archiveOwnerId: string,
    requesterId: string,
    requesterRole: string,
    pagination?: PaginationQueryDto,
    correlationId?: string,
  ): Promise<PaginatedResponseDto<ArchiveItem>> {
    const position = await this.resolveViewerPosition(
      requesterId,
      requesterRole,
      archiveOwnerId,
      correlationId,
    );

    const hideCarnet = this.shouldHideCarnetPersonnel(position, requesterRole);

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const offset = (page - 1) * limit;

    const queryBuilder = this.archiveItemRepository
      .createQueryBuilder('item')
      .where('item.studentId = :studentId', { studentId: archiveOwnerId })
      .orderBy('item.occurredAt', 'DESC');

    if (hideCarnet) {
      queryBuilder.andWhere('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    }

    const total = await queryBuilder.getCount();
    if (total === 0) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }

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
   * POST /archives/students/:studentId/archive-links
   * Supporte l'idempotence via idempotencyKey.
   */
  async addArchiveLink(
    archiveOwnerId: string,
    dto: AddArchiveLinkDto,
    requesterRole: string,
  ): Promise<ArchiveItem> {
    if (!ROLES_ALLOWED_TO_WRITE_ARCHIVES.includes(requesterRole)) {
      throw new ForbiddenException(
        `Le rôle ${requesterRole} n'est pas autorisé à créer des liens archive`,
      );
    }

    if (dto.idempotencyKey) {
      const existingItem = await this.archiveItemRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingItem) {
        if (existingItem.studentId !== archiveOwnerId) {
          throw new ConflictException(
            `La clé d'idempotence ${dto.idempotencyKey} appartient à un autre titulaire`,
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
      studentId: archiveOwnerId,
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
   * Retourne les archives en vue calendrier (groupées par date d'occurrence).
   * GET /archives/students/:studentId/archive-timeline
   */
  async getArchiveTimeline(
    archiveOwnerId: string,
    requesterId: string,
    requesterRole: string,
    pagination?: PaginationQueryDto,
    correlationId?: string,
  ): Promise<PaginatedResponseDto<{ date: string; items: Partial<ArchiveItem>[] }>> {
    const position = await this.resolveViewerPosition(
      requesterId,
      requesterRole,
      archiveOwnerId,
      correlationId,
    );

    const hideCarnet = this.shouldHideCarnetPersonnel(position, requesterRole);

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
      .where('item.studentId = :studentId', { studentId: archiveOwnerId })
      .orderBy('item.occurredAt', 'ASC');

    if (hideCarnet) {
      queryBuilder.andWhere('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    }

    const allItems = await queryBuilder.getMany();
    if (allItems.length === 0) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }

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
   * GET /documents/:id/download
   *
   * Contrairement aux listes, le titulaire ne peut être connu qu'après lecture
   * de l'élément : la vérification de relation vient donc APRÈS le `findOne`.
   * En contrepartie, tous les refus — élément inexistant, aucune relation,
   * carnet personnel demandé par un parent, absence d'URL — répondent le MÊME
   * 404 avec le MÊME message. Un 403 sur le carnet personnel, comme le faisait
   * la version précédente, révélait son existence à qui n'a pas le droit d'en
   * connaître l'existence.
   */
  async getArchiveItemForDownload(
    archiveItemId: string,
    requesterId: string,
    requesterRole: string,
    correlationId?: string,
  ): Promise<ArchiveItem> {
    const archiveItem = await this.archiveItemRepository.findOne({
      where: { id: archiveItemId },
    });

    if (!archiveItem) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }

    const position = await this.resolveViewerPosition(
      requesterId,
      requesterRole,
      archiveItem.studentId,
      correlationId,
    );

    if (
      this.shouldHideCarnetPersonnel(position, requesterRole) &&
      archiveItem.itemType === ArchiveItemType.CARNET_PERSONNEL
    ) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }

    if (!archiveItem.downloadUrl) {
      throw new NotFoundException(NO_ARCHIVE_MESSAGE);
    }

    return archiveItem;
  }

  /**
   * Route interne : liste des archives d'une personne sans filtrage.
   * Utilisée par l'orchestration-service pour les workflows.
   */
  async listArchivesInternal(archiveOwnerId: string): Promise<ArchiveItem[]> {
    return this.archiveItemRepository.find({
      where: { studentId: archiveOwnerId },
      order: { occurredAt: 'DESC' },
    });
  }
}
