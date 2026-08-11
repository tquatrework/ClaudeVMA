import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  ArchiveController,
  ArchiveDocumentController,
} from '../../../src/archive/archive.controller';
import { ArchiveService } from '../../../src/archive/archive.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { OWNER_ACCESS_KEY } from '../../../src/common/decorators/owner-access.decorator';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';
import { AddArchiveLinkDto } from '../../../src/archive/dto/add-archive-link.dto';
import { ArchiveItemType } from '../../../src/common/enums/archive-item-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

// ─── Mock du service ──────────────────────────────────────────────────────────

const mockArchiveService = {
  listPedagogicalArchives: jest.fn(),
  addArchiveLink: jest.fn(),
  getArchiveTimeline: jest.fn(),
  getArchiveItemForDownload: jest.fn(),
};

const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-uuid-1';
const CORRELATION_ID = 'correlation-uuid-1';

const mockUser = { id: STUDENT_ID, email: 'eleve@example.com', role: UserRole.ELEVE };
const mockRequest = { user: mockUser };

const mockArchiveItem = {
  id: 'item-uuid-1',
  studentId: STUDENT_ID,
  itemType: ArchiveItemType.RESUME_DE_COURS,
  sourceId: 'session-uuid-1',
  sourceService: 'video-session-service',
  title: 'Résumé — Algèbre',
  downloadUrl: 'https://storage.example.com/resumes/session-uuid-1.pdf',
  pedagogicalPoints: 10,
  occurredAt: new Date('2026-06-12T14:00:00Z'),
  isParentVisible: true,
  createdAt: new Date(),
};

const mockPaginatedResult = {
  data: [mockArchiveItem],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArchiveController', () => {
  let controller: ArchiveController;
  let documentController: ArchiveDocumentController;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArchiveController, ArchiveDocumentController],
      providers: [
        { provide: ArchiveService, useValue: mockArchiveService },
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

    controller = module.get<ArchiveController>(ArchiveController);
    documentController = module.get<ArchiveDocumentController>(ArchiveDocumentController);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  // ─── Contrôle d'accès déclaré sur les routes ────────────────────────────────

  describe('déclaration du contrôle d\'accès', () => {
    it.each([
      ['listPedagogicalArchives', () => controller.listPedagogicalArchives],
      ['getArchiveTimeline', () => controller.getArchiveTimeline],
    ])(
      'la lecture %s porte @OwnerAccess() et AUCUNE liste de rôles',
      (_name, handlerAccessor) => {
        const handler = handlerAccessor();

        expect(reflector.get<boolean>(OWNER_ACCESS_KEY, handler)).toBe(true);
        expect(reflector.get<UserRole[]>(ROLES_KEY, handler)).toBeUndefined();
      },
    );

    it('le téléchargement porte @OwnerAccess() et aucune liste de rôles', () => {
      const handler = documentController.downloadArchiveDocument;

      expect(reflector.get<boolean>(OWNER_ACCESS_KEY, handler)).toBe(true);
      expect(reflector.get<UserRole[]>(ROLES_KEY, handler)).toBeUndefined();
    });

    it('l\'écriture garde une liste de rôles explicite — une relation n\'ouvre jamais l\'écriture', () => {
      const handler = controller.addArchiveLink;

      expect(reflector.get<boolean>(OWNER_ACCESS_KEY, handler)).toBeUndefined();
      expect(reflector.get<UserRole[]>(ROLES_KEY, handler)).toEqual([
        UserRole.FORMATEUR,
        UserRole.ANIMATEUR_PEDAGOGIQUE,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.TECHNICIEN_INFORMATIQUE,
        UserRole.ADMINISTRATEUR_FINANCIER,
      ]);
    });
  });

  // ─── listPedagogicalArchives ────────────────────────────────────────────────

  describe('GET /archives/students/:studentId/pedagogical-archives', () => {
    it('délègue au service avec pagination et propage le correlation ID', async () => {
      mockArchiveService.listPedagogicalArchives.mockResolvedValue(mockPaginatedResult);

      const paginationQuery = { page: 1, limit: 20 };
      const result = await controller.listPedagogicalArchives(
        STUDENT_ID,
        paginationQuery,
        mockRequest,
        CORRELATION_ID,
      );

      expect(result).toEqual(mockPaginatedResult);
      expect(mockArchiveService.listPedagogicalArchives).toHaveBeenCalledWith(
        STUDENT_ID,
        mockUser.id,
        mockUser.role,
        paginationQuery,
        CORRELATION_ID,
      );
    });

    it('retourne les métadonnées de pagination dans la réponse', async () => {
      mockArchiveService.listPedagogicalArchives.mockResolvedValue({
        data: [mockArchiveItem],
        page: 2,
        limit: 10,
        total: 42,
        totalPages: 5,
      });

      const result = await controller.listPedagogicalArchives(
        STUDENT_ID,
        { page: 2, limit: 10 },
        mockRequest,
      );

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(5);
    });

    it('propage le 404 du service — refus et absence sont indiscernables', async () => {
      mockArchiveService.listPedagogicalArchives.mockRejectedValue(
        new NotFoundException('Aucune archive pédagogique accessible pour cette personne'),
      );

      await expect(
        controller.listPedagogicalArchives(STUDENT_ID, {}, mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage le 503 quand les relations n\'ont pas pu être vérifiées', async () => {
      mockArchiveService.listPedagogicalArchives.mockRejectedValue(
        new ServiceUnavailableException('profile-service injoignable'),
      );

      await expect(
        controller.listPedagogicalArchives(STUDENT_ID, {}, mockRequest),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // ─── addArchiveLink ─────────────────────────────────────────────────────────

  describe('POST /archives/students/:studentId/archive-links', () => {
    const addDto: AddArchiveLinkDto = {
      itemType: ArchiveItemType.RESUME_DE_COURS,
      sourceId: 'session-uuid-1',
      sourceService: 'video-session-service',
      title: 'Résumé — Algèbre',
      occurredAt: '2026-06-12T14:00:00Z',
    };

    it('crée un lien archive en transmettant le rôle du demandeur', async () => {
      mockArchiveService.addArchiveLink.mockResolvedValue(mockArchiveItem);
      const teacherRequest = { user: { ...mockUser, role: UserRole.FORMATEUR } };

      const result = await controller.addArchiveLink(STUDENT_ID, addDto, teacherRequest);

      expect(result).toEqual(mockArchiveItem);
      expect(mockArchiveService.addArchiveLink).toHaveBeenCalledWith(
        STUDENT_ID,
        addDto,
        UserRole.FORMATEUR,
      );
    });
  });

  // ─── getArchiveTimeline ─────────────────────────────────────────────────────

  describe('GET /archives/students/:studentId/archive-timeline', () => {
    it('retourne la vue calendrier paginée et propage le correlation ID', async () => {
      const paginatedTimeline = {
        data: [{ date: '2026-06-12', items: [{ id: 'item-uuid-1', title: 'Résumé — Algèbre' }] }],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };
      mockArchiveService.getArchiveTimeline.mockResolvedValue(paginatedTimeline);

      const paginationQuery = { page: 1, limit: 20 };
      const result = await controller.getArchiveTimeline(
        STUDENT_ID,
        paginationQuery,
        mockRequest,
        CORRELATION_ID,
      );

      expect(result).toEqual(paginatedTimeline);
      expect(mockArchiveService.getArchiveTimeline).toHaveBeenCalledWith(
        STUDENT_ID,
        mockUser.id,
        mockUser.role,
        paginationQuery,
        CORRELATION_ID,
      );
    });

    it('propage le 404 du service', async () => {
      mockArchiveService.getArchiveTimeline.mockRejectedValue(
        new NotFoundException('Aucune archive pédagogique accessible pour cette personne'),
      );

      await expect(controller.getArchiveTimeline(STUDENT_ID, {}, mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── downloadArchiveDocument ────────────────────────────────────────────────

  describe('GET /documents/:id/download', () => {
    it('retourne l\'URL de redirection pour téléchargement', async () => {
      mockArchiveService.getArchiveItemForDownload.mockResolvedValue(mockArchiveItem);

      const result = await documentController.downloadArchiveDocument(
        mockArchiveItem.id,
        mockRequest,
        CORRELATION_ID,
      );

      expect(result).toEqual({ url: mockArchiveItem.downloadUrl });
      expect(mockArchiveService.getArchiveItemForDownload).toHaveBeenCalledWith(
        mockArchiveItem.id,
        mockUser.id,
        mockUser.role,
        CORRELATION_ID,
      );
    });

    it('propage NotFoundException — élément absent comme accès refusé', async () => {
      mockArchiveService.getArchiveItemForDownload.mockRejectedValue(
        new NotFoundException('Aucune archive pédagogique accessible pour cette personne'),
      );

      await expect(
        documentController.downloadArchiveDocument('nonexistent-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('le carnet personnel demandé par un parent remonte un 404, jamais un 403', async () => {
      mockArchiveService.getArchiveItemForDownload.mockRejectedValue(
        new NotFoundException('Aucune archive pédagogique accessible pour cette personne'),
      );

      const error = await documentController
        .downloadArchiveDocument('carnet-item-id', {
          user: { ...mockUser, role: UserRole.PARENT_FINANCEUR },
        })
        .catch((thrown) => thrown);

      expect(error).toBeInstanceOf(NotFoundException);
    });
  });
});
