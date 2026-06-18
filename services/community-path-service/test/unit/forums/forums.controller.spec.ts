/**
 * Unit tests — ForumsController
 *
 * Couvre :
 *   - POST /forums          → délègue au service, retourne le forum créé
 *   - GET  /forums          → délègue au service avec le rôle courant
 *   - POST /forums/:id/comments   → délègue avec forumId, dto, userId, role
 *   - POST /forums/:id/exclusions → délègue avec forumId, dto, userId, role
 *   - Propagation des exceptions du service
 *
 * Les guards JwtAuthGuard et RolesGuard sont mockés pour isoler le contrôleur.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ForumsController } from '../../../src/forums/forums.controller';
import { ForumsService } from '../../../src/forums/forums.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { CreateForumDto } from '../../../src/forums/dto/create-forum.dto';
import { CreateForumCommentDto } from '../../../src/forums/dto/create-forum-comment.dto';
import { CreateForumExclusionDto } from '../../../src/forums/dto/create-forum-exclusion.dto';
import { ForumPublic } from '../../../src/common/enums/forum-public.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

// ─── Mock du service ──────────────────────────────────────────────────────────

const mockForumsService = {
  createForum: jest.fn(),
  findAllForums: jest.fn(),
  addComment: jest.fn(),
  excludeMember: jest.fn(),
};

// Guards mockés pour isoler le contrôleur des dépendances externes
const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RP_ID = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const FORUM_ID = 'fr-0000-4000-0000-000000000000';

const rpUser = { id: RP_ID, email: 'rp@example.com', role: UserRole.RESPONSABLE_PEDAGOGIQUE, validationStatus: 'active', jti: 'jti-rp' };
const apUser = { id: AP_ID, email: 'ap@example.com', role: UserRole.ANIMATEUR_PEDAGOGIQUE, validationStatus: 'active', jti: 'jti-ap' };
const eleveUser = { id: ELEVE_ID, email: 'eleve@example.com', role: UserRole.ELEVE, validationStatus: 'active', jti: 'jti-eleve' };

const mockForum = {
  id: FORUM_ID,
  title: 'Forum Algèbre',
  description: 'Forum sur algèbre',
  public: ForumPublic.MIXTE,
  createdById: RP_ID,
  createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
  isPublished: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumsController', () => {
  let controller: ForumsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumsController],
      providers: [
        { provide: ForumsService, useValue: mockForumsService },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ForumsController>(ForumsController);
    jest.clearAllMocks();
  });

  // ─── POST /forums ────────────────────────────────────────────────────────────

  describe('POST /forums — createForum()', () => {
    const createForumDto: CreateForumDto = {
      title: 'Forum Algèbre',
      description: 'Forum de discussion autour de l\'algèbre',
      public: ForumPublic.MIXTE,
    };

    it('délègue au service avec le DTO, l\'id et le rôle du créateur RP', async () => {
      mockForumsService.createForum.mockResolvedValue(mockForum);

      const result = await controller.createForum(createForumDto, rpUser);

      expect(mockForumsService.createForum).toHaveBeenCalledWith(
        createForumDto,
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result).toEqual(mockForum);
    });

    it('délègue au service avec le rôle AP — forum créé non publié', async () => {
      const unpublishedForum = { ...mockForum, isPublished: false, createdById: AP_ID };
      mockForumsService.createForum.mockResolvedValue(unpublishedForum);

      const result = await controller.createForum(createForumDto, apUser);

      expect(mockForumsService.createForum).toHaveBeenCalledWith(
        createForumDto,
        AP_ID,
        UserRole.ANIMATEUR_PEDAGOGIQUE,
      );
      expect(result.isPublished).toBe(false);
    });

    it('propage ForbiddenException si le service rejette le rôle', async () => {
      mockForumsService.createForum.mockRejectedValue(
        new ForbiddenException('Seuls les RP et AP peuvent créer des forums'),
      );

      await expect(
        controller.createForum(createForumDto, eleveUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── GET /forums ─────────────────────────────────────────────────────────────

  describe('GET /forums — findAllForums()', () => {
    it('délègue au service avec le rôle de l\'utilisateur courant', async () => {
      mockForumsService.findAllForums.mockResolvedValue([mockForum]);

      const result = await controller.findAllForums(rpUser);

      expect(mockForumsService.findAllForums).toHaveBeenCalledWith(
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result).toEqual([mockForum]);
    });

    it('retourne une liste vide si aucun forum n\'est publié pour un élève', async () => {
      mockForumsService.findAllForums.mockResolvedValue([]);

      const result = await controller.findAllForums(eleveUser);

      expect(mockForumsService.findAllForums).toHaveBeenCalledWith(UserRole.ELEVE);
      expect(result).toEqual([]);
    });

    it('retourne tous les forums publiés et non publiés pour un RP', async () => {
      const forums = [mockForum, { ...mockForum, id: 'fr-other', isPublished: false }];
      mockForumsService.findAllForums.mockResolvedValue(forums);

      const result = await controller.findAllForums(rpUser);

      expect(result).toHaveLength(2);
    });
  });

  // ─── POST /forums/:id/comments ───────────────────────────────────────────────

  describe('POST /forums/:id/comments — addComment()', () => {
    const commentDto: CreateForumCommentDto = { content: 'Très bonne question !' };

    const mockComment = {
      id: 'cmt-001',
      forumId: FORUM_ID,
      authorId: ELEVE_ID,
      authorRole: UserRole.ELEVE,
      content: 'Très bonne question !',
      createdAt: new Date(),
    };

    it('délègue au service avec forumId, dto, userId et rôle', async () => {
      mockForumsService.addComment.mockResolvedValue(mockComment);

      const result = await controller.addComment(FORUM_ID, commentDto, eleveUser);

      expect(mockForumsService.addComment).toHaveBeenCalledWith(
        FORUM_ID,
        commentDto,
        ELEVE_ID,
        UserRole.ELEVE,
      );
      expect(result).toEqual(mockComment);
    });

    it('propage NotFoundException si le forum est introuvable', async () => {
      mockForumsService.addComment.mockRejectedValue(
        new NotFoundException(`Forum ${FORUM_ID} introuvable`),
      );

      await expect(
        controller.addComment(FORUM_ID, commentDto, eleveUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage ForbiddenException si l\'utilisateur est exclu du forum', async () => {
      mockForumsService.addComment.mockRejectedValue(
        new ForbiddenException('Vous avez été exclu de ce forum'),
      );

      await expect(
        controller.addComment(FORUM_ID, commentDto, eleveUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage ForbiddenException si le forum n\'est pas publié', async () => {
      mockForumsService.addComment.mockRejectedValue(
        new ForbiddenException('Ce forum n\'est pas encore publié'),
      );

      await expect(
        controller.addComment(FORUM_ID, commentDto, eleveUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── POST /forums/:id/exclusions ─────────────────────────────────────────────

  describe('POST /forums/:id/exclusions — excludeMember()', () => {
    const exclusionDto: CreateForumExclusionDto = {
      excludedUserId: ELEVE_ID,
      reason: 'Comportement inapproprié',
    };

    const mockExclusion = {
      id: 'exc-001',
      forumId: FORUM_ID,
      excludedUserId: ELEVE_ID,
      excludedByUserId: RP_ID,
      reason: 'Comportement inapproprié',
      createdAt: new Date(),
    };

    it('délègue au service avec forumId, dto, userId et rôle', async () => {
      mockForumsService.excludeMember.mockResolvedValue(mockExclusion);

      const result = await controller.excludeMember(FORUM_ID, exclusionDto, rpUser);

      expect(mockForumsService.excludeMember).toHaveBeenCalledWith(
        FORUM_ID,
        exclusionDto,
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result).toEqual(mockExclusion);
    });

    it('propage NotFoundException si le forum est introuvable', async () => {
      mockForumsService.excludeMember.mockRejectedValue(
        new NotFoundException(`Forum ${FORUM_ID} introuvable`),
      );

      await expect(
        controller.excludeMember(FORUM_ID, exclusionDto, rpUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage ForbiddenException si le demandeur n\'est pas propriétaire ou RP', async () => {
      mockForumsService.excludeMember.mockRejectedValue(
        new ForbiddenException('Seul le propriétaire du forum ou un RP peut exclure des membres'),
      );

      await expect(
        controller.excludeMember(FORUM_ID, exclusionDto, apUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage BadRequestException si le membre est déjà exclu', async () => {
      mockForumsService.excludeMember.mockRejectedValue(
        new BadRequestException('Cet utilisateur est déjà exclu de ce forum'),
      );

      await expect(
        controller.excludeMember(FORUM_ID, exclusionDto, rpUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
