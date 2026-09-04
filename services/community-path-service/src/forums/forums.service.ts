import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Forum } from './entities/forum.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumExclusion } from './entities/forum-exclusion.entity';
import { ForumCharterSetting } from './entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from './entities/forum-charter-acceptance.entity';
import { CreateForumDto } from './dto/create-forum.dto';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { CreateForumExclusionDto } from './dto/create-forum-exclusion.dto';
import { UpdateForumCharterDto } from './dto/update-forum-charter.dto';
import { UpdateForumDto } from './dto/update-forum.dto';
import { UserRole } from '../common/enums/user-role.enum';
import {
  FORUM_ADMIN_BYPASS_ROLES,
  FORUM_CHARTER_MANAGER_ROLES,
  FORUM_CREATOR_ROLES,
} from '../common/constants/forum-access.constants';
import {
  ForumImageStorageService,
} from './services/forum-image-storage.service';
import { Pagination, PaginatedResult, buildPaginatedResult } from '../common/utils/pagination.util';

/**
 * Un forum est visible/accessible à un rôle donné si :
 *  - ce rôle fait partie des rôles administratifs à accès illimité, ou
 *  - le forum n'a aucune restriction (allowedRoles vide/null), ou
 *  - le rôle figure explicitement dans allowedRoles.
 */
export function isRoleAllowedForForum(userRole: string, forum: Pick<Forum, 'allowedRoles'>): boolean {
  if (FORUM_ADMIN_BYPASS_ROLES.includes(userRole)) return true;
  if (!forum.allowedRoles || forum.allowedRoles.length === 0) return true;
  return forum.allowedRoles.includes(userRole);
}

/**
 * Un forum masqué (isHidden) est invisible à tout le monde sauf au RP —
 * arbitrage du 2026-09-04. Volontairement plus strict que le bypass
 * "restriction de rôle" ci-dessus (FORUM_ADMIN_BYPASS_ROLES, qui inclut aussi
 * AF/TI) : seul le RP, créateur exclusif des forums, voit un forum caché.
 */
export function isForumHiddenFromRole(userRole: string, forum: Pick<Forum, 'isHidden'>): boolean {
  return forum.isHidden === true && userRole !== UserRole.RESPONSABLE_PEDAGOGIQUE;
}

export interface CharterStatus {
  content: string;
  updatedAt: Date;
}

export interface CharterAcceptanceStatus {
  accepted: boolean;
  acceptedAt: Date | null;
}

@Injectable()
export class ForumsService {
  constructor(
    @InjectRepository(Forum)
    private readonly forumRepository: Repository<Forum>,
    @InjectRepository(ForumComment)
    private readonly commentRepository: Repository<ForumComment>,
    @InjectRepository(ForumExclusion)
    private readonly exclusionRepository: Repository<ForumExclusion>,
    @InjectRepository(ForumCharterSetting)
    private readonly charterSettingRepository: Repository<ForumCharterSetting>,
    @InjectRepository(ForumCharterAcceptance)
    private readonly charterAcceptanceRepository: Repository<ForumCharterAcceptance>,
    private readonly imageStorage: ForumImageStorageService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────
  // Forums
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Crée un nouveau forum. Réservé au RP (arbitrage du 2026-09-04 : l'AP
   * perd ce droit). Un forum créé par un RP est visible dès sa création,
   * aucun mécanisme de publication/validation n'existe plus.
   */
  async createForum(
    createForumDto: CreateForumDto,
    creatorId: string,
    creatorRole: string,
  ): Promise<Forum> {
    if (!FORUM_CREATOR_ROLES.includes(creatorRole)) {
      throw new ForbiddenException('Seul le responsable pédagogique peut créer un forum');
    }

    const newForum = this.forumRepository.create({
      title: createForumDto.title,
      description: createForumDto.description,
      level: createForumDto.level,
      difficulty: createForumDto.difficulty,
      theme: createForumDto.theme,
      competences: createForumDto.competences,
      tags: createForumDto.tags,
      allowedRoles:
        createForumDto.allowedRoles && createForumDto.allowedRoles.length > 0
          ? createForumDto.allowedRoles
          : null,
      createdById: creatorId,
      createdByRole: creatorRole,
    });

    return this.forumRepository.save(newForum);
  }

  /**
   * Liste les forums visibles par l'appelant. Un compte dont le rôle n'est
   * pas autorisé sur un forum restreint ne le voit pas apparaître (jamais un
   * refus explicite qui révélerait son existence). `tags` filtre en plus sur
   * une correspondance partielle, insensible à la casse, sur le champ tags.
   *
   * `mine=true` (arbitrage du 2026-09-04, même convention que "mine=true"
   * pour Quizz/Exercice dans content-catalog-service) : ne renvoie que les
   * forums créés par l'appelant, tous statuts confondus — y compris ses
   * propres forums cachés, seul moyen pour le RP de les retrouver puisqu'un
   * forum caché est sinon invisible même pour lui dans la liste générale.
   */
  async findAllForums(
    requesterId: string,
    requesterRole: string,
    tags?: string[],
    mine?: boolean,
  ): Promise<Forum[]> {
    const queryBuilder = this.forumRepository
      .createQueryBuilder('forum')
      .orderBy('forum.createdAt', 'DESC');

    if (mine) {
      queryBuilder.andWhere('forum.createdById = :requesterId', { requesterId });
    } else {
      if (!FORUM_ADMIN_BYPASS_ROLES.includes(requesterRole)) {
        queryBuilder.andWhere(
          new Brackets((qb) => {
            qb.where('forum.allowedRoles IS NULL').orWhere(':requesterRole = ANY(forum.allowedRoles)', {
              requesterRole,
            });
          }),
        );
      }

      // Un forum caché est invisible à tout le monde sauf au RP (2026-09-04)
      // — plus strict que le bypass "restriction de rôle" ci-dessus, qui
      // inclut aussi AF/TI : ceux-ci ne voient pas un forum caché non plus.
      if (requesterRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
        queryBuilder.andWhere('forum.isHidden = false');
      }
    }

    const cleanedTags = (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    if (cleanedTags.length > 0) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          cleanedTags.forEach((tag, index) => {
            qb.orWhere(`forum.tags ILIKE :tag${index}`, { [`tag${index}`]: `%${tag}%` });
          });
        }),
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Détail d'un forum unique. Même masquage 404 que `findAllForums` pour un
   * rôle non autorisé — voir `getAccessibleForumOrThrow`. Route ajoutée le
   * 2026-09-04 (suite directe de la PR #230) : jusqu'ici seule la liste
   * exposait la forme complète de l'entité, aucune route de détail n'existait.
   */
  async getForum(forumId: string, requesterRole: string): Promise<Forum> {
    return this.getAccessibleForumOrThrow(forumId, requesterRole);
  }

  /**
   * Récupère un forum accessible par le rôle donné, ou lève NotFoundException
   * si le forum n'existe pas, si le rôle n'y est pas autorisé, ou si le forum
   * est caché pour ce rôle (2026-09-04) — dans tous les cas la même erreur,
   * pour ne jamais révéler l'existence d'un forum auquel l'appelant n'a pas
   * accès.
   */
  private async getAccessibleForumOrThrow(
    forumId: string,
    requesterRole: string,
    relations: string[] = [],
  ): Promise<Forum> {
    const forum = await this.forumRepository.findOne({ where: { id: forumId }, relations });
    if (
      !forum ||
      !isRoleAllowedForForum(requesterRole, forum) ||
      isForumHiddenFromRole(requesterRole, forum)
    ) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }
    return forum;
  }

  /**
   * Édite les métadonnées d'un forum — arbitrage du 2026-09-04. Réservé au
   * rôle RP dans son ensemble (pas seulement le créateur du forum), même
   * principe que `hideForum` ci-dessous : les forums sont un outil collectif
   * de la fonction RP, pas un contenu individuel. Seuls les champs fournis
   * dans le DTO sont modifiés ; un forum caché reste éditable (le masquage
   * n'est pas un état terminal). L'image d'illustration n'est pas concernée,
   * elle reste gérée par uploadForumImage.
   */
  async updateForum(
    forumId: string,
    updateForumDto: UpdateForumDto,
    actorRole: string,
  ): Promise<Forum> {
    if (actorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pédagogique peut éditer un forum');
    }

    const forum = await this.forumRepository.findOne({ where: { id: forumId } });
    if (!forum) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }

    if (updateForumDto.title !== undefined) forum.title = updateForumDto.title;
    if (updateForumDto.description !== undefined) forum.description = updateForumDto.description;
    if (updateForumDto.level !== undefined) forum.level = updateForumDto.level;
    if (updateForumDto.difficulty !== undefined) forum.difficulty = updateForumDto.difficulty;
    if (updateForumDto.theme !== undefined) forum.theme = updateForumDto.theme;
    if (updateForumDto.competences !== undefined) forum.competences = updateForumDto.competences;
    if (updateForumDto.tags !== undefined) forum.tags = updateForumDto.tags;
    if (updateForumDto.allowedRoles !== undefined) {
      forum.allowedRoles =
        updateForumDto.allowedRoles && updateForumDto.allowedRoles.length > 0
          ? updateForumDto.allowedRoles
          : null;
    }

    return this.forumRepository.save(forum);
  }

  /**
   * Masque un forum pour tout le monde sauf le RP — arbitrage du 2026-09-04.
   * Non destructif : pose un indicateur d'état, ne supprime jamais la ligne.
   * Idempotent : masquer un forum déjà caché ne réécrit pas la trace
   * d'origine (hiddenAt/hiddenByUserId), simplement renvoyé tel quel.
   */
  async hideForum(forumId: string, actorId: string, actorRole: string): Promise<Forum> {
    if (actorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pédagogique peut masquer un forum');
    }

    const forum = await this.forumRepository.findOne({ where: { id: forumId } });
    if (!forum) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }

    if (forum.isHidden) {
      return forum;
    }

    forum.isHidden = true;
    forum.hiddenAt = new Date();
    forum.hiddenByUserId = actorId;
    return this.forumRepository.save(forum);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Commentaires
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Ajoute un commentaire à un forum. Le rôle doit être autorisé sur ce
   * forum, l'utilisateur ne doit pas être exclu, et il doit avoir accepté la
   * charte de bonne conduite au préalable (arbitrage du 2026-09-04 : la
   * lecture reste ouverte sans acceptation, seule la participation l'exige).
   */
  async addComment(
    forumId: string,
    createCommentDto: CreateForumCommentDto,
    authorId: string,
    authorRole: string,
  ): Promise<ForumComment> {
    const forum = await this.getAccessibleForumOrThrow(forumId, authorRole, ['exclusions']);

    const isExcluded = forum.exclusions.some(
      (exclusion) => exclusion.excludedUserId === authorId,
    );
    if (isExcluded) {
      throw new ForbiddenException('Vous avez été exclu de ce forum');
    }

    const hasAcceptedCharter = await this.hasAcceptedCharter(authorId);
    if (!hasAcceptedCharter) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'CHARTER_NOT_ACCEPTED',
        message: 'Vous devez accepter la charte de bonne conduite avant de participer à un forum',
      });
    }

    const newComment = this.commentRepository.create({
      forumId,
      authorId,
      authorRole,
      content: createCommentDto.content,
    });

    return this.commentRepository.save(newComment);
  }

  /**
   * Supprime un commentaire a posteriori. Réservé au RP (l'énoncé ne
   * mentionne que ce rôle — pas d'extension à l'auteur ni à l'AP).
   */
  async deleteComment(forumId: string, commentId: string, moderatorRole: string): Promise<void> {
    if (moderatorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un responsable pédagogique peut supprimer un commentaire');
    }

    const comment = await this.commentRepository.findOne({ where: { id: commentId, forumId } });
    if (!comment) {
      throw new NotFoundException(`Commentaire ${commentId} introuvable sur ce forum`);
    }

    await this.commentRepository.remove(comment);
  }

  /**
   * Liste paginée des commentaires d'un forum, du plus ancien au plus récent
   * (ordre de lecture d'un fil de discussion — choix explicite, l'arbitrage
   * ne précisait pas de sens). Mêmes droits de lecture que le détail du forum
   * (même masquage 404). Route ajoutée le 2026-09-04, gap réel signalé après
   * la PR #230 : `POST /forums/:id/comments` permettait de publier sans
   * jamais pouvoir relire les commentaires déjà publiés.
   */
  async getForumComments(
    forumId: string,
    requesterRole: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<ForumComment>> {
    await this.getAccessibleForumOrThrow(forumId, requesterRole);

    const [data, total] = await this.commentRepository.findAndCount({
      where: { forumId },
      order: { createdAt: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return buildPaginatedResult(data, total, pagination);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Exclusions
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Exclut un membre d'un forum. Réservé au propriétaire du forum ou à un
   * RP. Mécanisme inchangé par l'arbitrage du 2026-09-04, complémentaire à
   * la restriction par rôle (l'un exclut une personne précise, l'autre une
   * catégorie entière).
   */
  async excludeMember(
    forumId: string,
    createExclusionDto: CreateForumExclusionDto,
    moderatorId: string,
    moderatorRole: string,
  ): Promise<ForumExclusion> {
    const forum = await this.forumRepository.findOne({
      where: { id: forumId },
    });

    if (!forum) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }

    const isForumOwner = forum.createdById === moderatorId;
    const isRp = moderatorRole === UserRole.RESPONSABLE_PEDAGOGIQUE;

    if (!isForumOwner && !isRp) {
      throw new ForbiddenException('Seul le propriétaire du forum ou un RP peut exclure des membres');
    }

    const existingExclusion = await this.exclusionRepository.findOne({
      where: { forumId, excludedUserId: createExclusionDto.excludedUserId },
    });

    if (existingExclusion) {
      throw new BadRequestException('Cet utilisateur est déjà exclu de ce forum');
    }

    const newExclusion = this.exclusionRepository.create({
      forumId,
      excludedUserId: createExclusionDto.excludedUserId,
      excludedByUserId: moderatorId,
      reason: createExclusionDto.reason,
    });

    return this.exclusionRepository.save(newExclusion);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Charte de bonne conduite
  // ───────────────────────────────────────────────────────────────────────

  private async getOrCreateCharterSetting(): Promise<ForumCharterSetting> {
    const existing = await this.charterSettingRepository.find({ take: 1 });
    if (existing.length > 0) return existing[0];

    const created = this.charterSettingRepository.create({ content: '' });
    return this.charterSettingRepository.save(created);
  }

  async getCharter(): Promise<CharterStatus> {
    const setting = await this.getOrCreateCharterSetting();
    return { content: setting.content, updatedAt: setting.updatedAt };
  }

  async updateCharter(
    dto: UpdateForumCharterDto,
    updaterId: string,
    updaterRole: string,
  ): Promise<CharterStatus> {
    if (!FORUM_CHARTER_MANAGER_ROLES.includes(updaterRole)) {
      throw new ForbiddenException(
        'Seul un responsable pédagogique ou un technicien informatique peut modifier la charte',
      );
    }

    const setting = await this.getOrCreateCharterSetting();
    setting.content = dto.content;
    setting.updatedByUserId = updaterId;
    const saved = await this.charterSettingRepository.save(setting);
    return { content: saved.content, updatedAt: saved.updatedAt };
  }

  private async hasAcceptedCharter(userId: string): Promise<boolean> {
    const acceptance = await this.charterAcceptanceRepository.findOne({ where: { userId } });
    return acceptance !== null;
  }

  async getCharterAcceptanceStatus(userId: string): Promise<CharterAcceptanceStatus> {
    const acceptance = await this.charterAcceptanceRepository.findOne({ where: { userId } });
    return { accepted: acceptance !== null, acceptedAt: acceptance?.acceptedAt ?? null };
  }

  /**
   * Accepte la charte pour l'utilisateur courant. Idempotent : accepter à
   * nouveau alors que c'est déjà fait n'est pas une erreur, renvoie
   * l'acceptation existante.
   */
  async acceptCharter(userId: string): Promise<{ status: CharterAcceptanceStatus; alreadyAccepted: boolean }> {
    const existing = await this.charterAcceptanceRepository.findOne({ where: { userId } });
    if (existing) {
      return {
        status: { accepted: true, acceptedAt: existing.acceptedAt },
        alreadyAccepted: true,
      };
    }

    const created = this.charterAcceptanceRepository.create({ userId });
    const saved = await this.charterAcceptanceRepository.save(created);
    return {
      status: { accepted: true, acceptedAt: saved.acceptedAt },
      alreadyAccepted: false,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Image d'illustration
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Téléverse (ou remplace) l'image d'illustration d'un forum. Réservé au
   * RP, sur le même principe que la création (seul rôle à administrer les
   * forums désormais).
   */
  async uploadForumImage(forumId: string, buffer: Buffer, actorRole: string): Promise<Forum> {
    if (actorRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException("Seul un responsable pédagogique peut modifier l'image d'un forum");
    }

    const forum = await this.forumRepository.findOne({ where: { id: forumId } });
    if (!forum) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }

    const previousFilename = forum.imageFilename;
    const stored = await this.imageStorage.store(buffer);

    forum.imageFilename = stored.filename;
    forum.imageMimeType = stored.mimeType;
    const saved = await this.forumRepository.save(forum);

    if (previousFilename) {
      await this.imageStorage.remove(previousFilename);
    }

    return saved;
  }

  /**
   * Lit l'image d'un forum. Réapplique la restriction de rôle du forum :
   * un forum masqué pour ce rôle masque aussi son image (404, jamais 403).
   */
  async getForumImage(
    forumId: string,
    requesterRole: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const forum = await this.getAccessibleForumOrThrow(forumId, requesterRole);

    if (!forum.imageFilename || !forum.imageMimeType) {
      throw new NotFoundException(`Le forum ${forumId} n'a pas d'image d'illustration`);
    }

    const buffer = await this.imageStorage.read(forum.imageFilename);
    return { buffer, mimeType: forum.imageMimeType };
  }
}
