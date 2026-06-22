import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Forum } from './entities/forum.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumExclusion } from './entities/forum-exclusion.entity';
import { CreateForumDto } from './dto/create-forum.dto';
import { CreateForumCommentDto } from './dto/create-forum-comment.dto';
import { CreateForumExclusionDto } from './dto/create-forum-exclusion.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { ForumPublic } from '../common/enums/forum-public.enum';

const FORUM_CREATOR_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

/**
 * Determines whether a user role is allowed to access a forum based on its public setting.
 */
export function isRoleAllowedForForumPublic(userRole: string, forumPublic: ForumPublic): boolean {
  if (forumPublic === ForumPublic.MIXTE) return true;
  if (forumPublic === ForumPublic.ETUDIANT) {
    return [
      UserRole.ELEVE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(userRole as UserRole);
  }
  if (forumPublic === ForumPublic.PROFESSEUR) {
    return [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(userRole as UserRole);
  }
  return false;
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
  ) {}

  /**
   * Create a new forum. Only RP and AP can create forums.
   * RP-created forums are immediately published; AP-created forums need RP validation.
   */
  async createForum(
    createForumDto: CreateForumDto,
    creatorId: string,
    creatorRole: string,
  ): Promise<Forum> {
    if (!FORUM_CREATOR_ROLES.includes(creatorRole)) {
      throw new ForbiddenException('Seuls les RP et AP peuvent créer des forums');
    }

    const isPublished = creatorRole === UserRole.RESPONSABLE_PEDAGOGIQUE;

    const newForum = this.forumRepository.create({
      title: createForumDto.title,
      description: createForumDto.description,
      level: createForumDto.level,
      difficulty: createForumDto.difficulty,
      theme: createForumDto.theme,
      competences: createForumDto.competences,
      tags: createForumDto.tags,
      public: createForumDto.public ?? ForumPublic.MIXTE,
      createdById: creatorId,
      createdByRole: creatorRole,
      isPublished,
    });

    return this.forumRepository.save(newForum);
  }

  /**
   * List forums. Returns only published forums unless the requester is RP or TI.
   */
  async findAllForums(requesterRole: string): Promise<Forum[]> {
    const isPrivilegedViewer =
      requesterRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      requesterRole === UserRole.TECHNICIEN_INFORMATIQUE;

    const whereClause = isPrivilegedViewer ? {} : { isPublished: true };

    return this.forumRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Add a comment to a forum.
   * The forum must be published and the user must not be excluded.
   * The user's role must match the forum's public setting.
   */
  async addComment(
    forumId: string,
    createCommentDto: CreateForumCommentDto,
    authorId: string,
    authorRole: string,
  ): Promise<ForumComment> {
    const forum = await this.forumRepository.findOne({
      where: { id: forumId },
      relations: ['exclusions'],
    });

    if (!forum) {
      throw new NotFoundException(`Forum ${forumId} introuvable`);
    }

    if (!forum.isPublished) {
      throw new ForbiddenException('Ce forum n\'est pas encore publié');
    }

    if (!isRoleAllowedForForumPublic(authorRole, forum.public)) {
      throw new ForbiddenException('Votre rôle ne vous permet pas d\'accéder à ce forum');
    }

    const isExcluded = forum.exclusions.some(
      (exclusion) => exclusion.excludedUserId === authorId,
    );
    if (isExcluded) {
      throw new ForbiddenException('Vous avez été exclu de ce forum');
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
   * Exclude a member from a forum.
   * Only the forum owner (RP) or a RP can exclude members.
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
}
