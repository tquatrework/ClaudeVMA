/**
 * Unit tests — ForumsController
 *
 * Couvre :
 *   - POST /forums                          → délègue au service (RP uniquement désormais)
 *   - GET  /forums                          → délègue avec le rôle courant + tags
 *   - GET/PATCH /forums/charter             → lecture/écriture de la charte
 *   - GET/POST /forums/charter/acceptance   → statut + acceptation idempotente (200/201)
 *   - GET /forums/image-constraints         → contraintes exposées
 *   - POST/GET /forums/:id/image            → upload et lecture
 *   - POST /forums/:id/comments             → délègue
 *   - DELETE /forums/:id/comments/:commentId → délègue (RP)
 *   - POST /forums/:id/exclusions           → délègue
 *
 * Les guards JwtAuthGuard et RolesGuard sont mockés pour isoler le contrôleur.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
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
import { UserRole } from '../../../src/common/enums/user-role.enum';

// ─── Mock du service ──────────────────────────────────────────────────────────

const mockForumsService = {
  createForum: jest.fn(),
  findAllForums: jest.fn(),
  addComment: jest.fn(),
  deleteComment: jest.fn(),
  excludeMember: jest.fn(),
  getCharter: jest.fn(),
  updateCharter: jest.fn(),
  getCharterAcceptanceStatus: jest.fn(),
  acceptCharter: jest.fn(),
  uploadForumImage: jest.fn(),
  getForumImage: jest.fn(),
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
  allowedRoles: null,
  createdById: RP_ID,
  createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function buildMockResponse() {
  return { status: jest.fn(), set: jest.fn() } as any;
}

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
      description: "Forum de discussion autour de l'algèbre",
    };

    it('délègue au service avec le DTO, l\'id et le rôle du créateur RP', async () => {
      mockForumsService.createForum.mockResolvedValue(mockForum);

      const result = await controller.createForum(createForumDto, rpUser);

      expect(mockForumsService.createForum).toHaveBeenCalledWith(createForumDto, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toEqual(mockForum);
    });

    it("propage ForbiddenException si le service rejette un rôle autre que RP (AP compris)", async () => {
      mockForumsService.createForum.mockRejectedValue(
        new ForbiddenException('Seul le responsable pédagogique peut créer un forum'),
      );

      await expect(controller.createForum(createForumDto, apUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── GET /forums ─────────────────────────────────────────────────────────────

  describe('GET /forums — findAllForums()', () => {
    it("délègue au service avec le rôle courant, sans tags si non fourni", async () => {
      mockForumsService.findAllForums.mockResolvedValue([mockForum]);

      const result = await controller.findAllForums(rpUser);

      expect(mockForumsService.findAllForums).toHaveBeenCalledWith(UserRole.RESPONSABLE_PEDAGOGIQUE, undefined);
      expect(result).toEqual([mockForum]);
    });

    it('découpe le paramètre tags en tableau', async () => {
      mockForumsService.findAllForums.mockResolvedValue([]);

      await controller.findAllForums(eleveUser, 'algèbre,trigonométrie');

      expect(mockForumsService.findAllForums).toHaveBeenCalledWith(UserRole.ELEVE, ['algèbre', 'trigonométrie']);
    });

    it('retourne une liste vide pour un rôle sans forum accessible', async () => {
      mockForumsService.findAllForums.mockResolvedValue([]);

      const result = await controller.findAllForums(eleveUser);

      expect(result).toEqual([]);
    });
  });

  // ─── Charte ────────────────────────────────────────────────────────────────

  describe('Charte de bonne conduite', () => {
    it('GET /forums/charter délègue au service', async () => {
      mockForumsService.getCharter.mockResolvedValue({ content: 'Soyez respectueux', updatedAt: new Date() });

      const result = await controller.getCharter();

      expect(result.content).toBe('Soyez respectueux');
    });

    it('PATCH /forums/charter délègue avec le contenu, l\'id et le rôle', async () => {
      mockForumsService.updateCharter.mockResolvedValue({ content: 'Nouveau texte', updatedAt: new Date() });

      await controller.updateCharter({ content: 'Nouveau texte' }, rpUser);

      expect(mockForumsService.updateCharter).toHaveBeenCalledWith(
        { content: 'Nouveau texte' },
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
    });

    it('GET /forums/charter/acceptance délègue au service avec userId', async () => {
      mockForumsService.getCharterAcceptanceStatus.mockResolvedValue({ accepted: false, acceptedAt: null });

      const result = await controller.getMyCharterAcceptance(eleveUser);

      expect(mockForumsService.getCharterAcceptanceStatus).toHaveBeenCalledWith(ELEVE_ID);
      expect(result.accepted).toBe(false);
    });

    it('POST /forums/charter/acceptance renvoie 201 si nouvelle acceptation', async () => {
      mockForumsService.acceptCharter.mockResolvedValue({
        status: { accepted: true, acceptedAt: new Date() },
        alreadyAccepted: false,
      });
      const res = buildMockResponse();

      await controller.acceptCharter(eleveUser, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    });

    it('POST /forums/charter/acceptance renvoie 200 si déjà acceptée (idempotent)', async () => {
      mockForumsService.acceptCharter.mockResolvedValue({
        status: { accepted: true, acceptedAt: new Date() },
        alreadyAccepted: true,
      });
      const res = buildMockResponse();

      await controller.acceptCharter(eleveUser, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });
  });

  // ─── Image d'illustration ────────────────────────────────────────────────

  describe("Image d'illustration", () => {
    it('GET /forums/image-constraints renvoie maxSizeBytes et allowedMimeTypes', async () => {
      const result = await controller.getImageConstraints();

      expect(result).toEqual(
        expect.objectContaining({ maxSizeBytes: expect.any(Number), allowedMimeTypes: expect.any(Array) }),
      );
    });

    it('POST /forums/:id/image lève BadRequestException si aucun fichier', async () => {
      await expect(
        controller.uploadForumImage(FORUM_ID, undefined as any, rpUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('POST /forums/:id/image délègue au service avec le buffer', async () => {
      mockForumsService.uploadForumImage.mockResolvedValue(mockForum);
      const file = { buffer: Buffer.from('fake'), size: 10 } as any;

      const result = await controller.uploadForumImage(FORUM_ID, file, rpUser);

      expect(mockForumsService.uploadForumImage).toHaveBeenCalledWith(FORUM_ID, file.buffer, UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toEqual(mockForum);
    });

    it('GET /forums/:id/image délègue et pose le Content-Type', async () => {
      mockForumsService.getForumImage.mockResolvedValue({ buffer: Buffer.from('img'), mimeType: 'image/jpeg' });
      const res = buildMockResponse();

      await controller.getForumImage(FORUM_ID, eleveUser, res);

      expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'image/jpeg' });
    });

    it('GET /forums/:id/image propage NotFoundException (masquage)', async () => {
      mockForumsService.getForumImage.mockRejectedValue(new NotFoundException());
      const res = buildMockResponse();

      await expect(controller.getForumImage(FORUM_ID, eleveUser, res)).rejects.toThrow(NotFoundException);
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

      expect(mockForumsService.addComment).toHaveBeenCalledWith(FORUM_ID, commentDto, ELEVE_ID, UserRole.ELEVE);
      expect(result).toEqual(mockComment);
    });

    it('propage NotFoundException si le forum est introuvable ou non accessible (masqué)', async () => {
      mockForumsService.addComment.mockRejectedValue(new NotFoundException(`Forum ${FORUM_ID} introuvable`));

      await expect(controller.addComment(FORUM_ID, commentDto, eleveUser)).rejects.toThrow(NotFoundException);
    });

    it('propage ForbiddenException si la charte n\'est pas acceptée', async () => {
      mockForumsService.addComment.mockRejectedValue(
        new ForbiddenException({ code: 'CHARTER_NOT_ACCEPTED', message: 'Charte non acceptée' }),
      );

      await expect(controller.addComment(FORUM_ID, commentDto, eleveUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── DELETE /forums/:id/comments/:commentId ──────────────────────────────

  describe('DELETE /forums/:id/comments/:commentId — deleteComment()', () => {
    it('délègue au service avec forumId, commentId et rôle', async () => {
      mockForumsService.deleteComment.mockResolvedValue(undefined);

      await controller.deleteComment(FORUM_ID, 'cmt-001', rpUser);

      expect(mockForumsService.deleteComment).toHaveBeenCalledWith(FORUM_ID, 'cmt-001', UserRole.RESPONSABLE_PEDAGOGIQUE);
    });

    it('propage ForbiddenException si un non-RP tente de supprimer', async () => {
      mockForumsService.deleteComment.mockRejectedValue(new ForbiddenException());

      await expect(controller.deleteComment(FORUM_ID, 'cmt-001', apUser)).rejects.toThrow(ForbiddenException);
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

      expect(mockForumsService.excludeMember).toHaveBeenCalledWith(FORUM_ID, exclusionDto, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);
      expect(result).toEqual(mockExclusion);
    });

    it('propage NotFoundException si le forum est introuvable', async () => {
      mockForumsService.excludeMember.mockRejectedValue(new NotFoundException(`Forum ${FORUM_ID} introuvable`));

      await expect(controller.excludeMember(FORUM_ID, exclusionDto, rpUser)).rejects.toThrow(NotFoundException);
    });

    it('propage BadRequestException si le membre est déjà exclu', async () => {
      mockForumsService.excludeMember.mockRejectedValue(new BadRequestException('Cet utilisateur est déjà exclu de ce forum'));

      await expect(controller.excludeMember(FORUM_ID, exclusionDto, rpUser)).rejects.toThrow(BadRequestException);
    });
  });
});
