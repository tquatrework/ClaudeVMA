import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ArchiveController } from '../../../src/archive/archive.controller';
import { ArchiveService } from '../../../src/archive/archive.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
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

// Guards mockés pour isoler le contrôleur des dépendances externes
const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-uuid-1';

const mockUser = {
  id: STUDENT_ID,
  email: 'eleve@example.com',
  role: UserRole.ELEVE,
};

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArchiveController],
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
    jest.clearAllMocks();
  });

  // ─── listPedagogicalArchives ────────────────────────────────────────────────

  describe('GET /students/:studentId/pedagogical-archives', () => {
    it('délègue au service avec pagination et retourne le résultat paginé', async () => {
      mockArchiveService.listPedagogicalArchives.mockResolvedValue(mockPaginatedResult);

      const paginationQuery = { page: 1, limit: 20 };
      const result = await controller.listPedagogicalArchives(STUDENT_ID, paginationQuery, mockRequest);

      expect(result).toEqual(mockPaginatedResult);
      expect(mockArchiveService.listPedagogicalArchives).toHaveBeenCalledWith(
        STUDENT_ID,
        mockUser.id,
        mockUser.role,
        paginationQuery,
      );
    });

    it('retourne les métadonnées de pagination dans la réponse', async () => {
      const paginatedResponse = {
        data: [mockArchiveItem],
        page: 2,
        limit: 10,
        total: 42,
        totalPages: 5,
      };
      mockArchiveService.listPedagogicalArchives.mockResolvedValue(paginatedResponse);

      const result = await controller.listPedagogicalArchives(
        STUDENT_ID,
        { page: 2, limit: 10 },
        mockRequest,
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(42);
      expect(result.totalPages).toBe(5);
    });

    it('propage ForbiddenException du service', async () => {
      mockArchiveService.listPedagogicalArchives.mockRejectedValue(
        new ForbiddenException('Accès interdit'),
      );

      await expect(
        controller.listPedagogicalArchives(STUDENT_ID, {}, mockRequest),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addArchiveLink ─────────────────────────────────────────────────────────

  describe('POST /students/:studentId/archive-links', () => {
    const addDto: AddArchiveLinkDto = {
      itemType: ArchiveItemType.RESUME_DE_COURS,
      sourceId: 'session-uuid-1',
      sourceService: 'video-session-service',
      title: 'Résumé — Algèbre',
      occurredAt: '2026-06-12T14:00:00Z',
    };

    it('crée un lien archive et retourne l\'élément créé', async () => {
      mockArchiveService.addArchiveLink.mockResolvedValue(mockArchiveItem);

      const result = await controller.addArchiveLink(STUDENT_ID, addDto, mockRequest);

      expect(result).toEqual(mockArchiveItem);
      expect(mockArchiveService.addArchiveLink).toHaveBeenCalledWith(STUDENT_ID, addDto);
    });
  });

  // ─── getArchiveTimeline ─────────────────────────────────────────────────────

  describe('GET /students/:studentId/archive-timeline', () => {
    it('retourne la vue calendrier paginée groupée par date', async () => {
      const paginatedTimeline = {
        data: [{ date: '2026-06-12', items: [{ id: 'item-uuid-1', title: 'Résumé — Algèbre' }] }],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };
      mockArchiveService.getArchiveTimeline.mockResolvedValue(paginatedTimeline);

      const paginationQuery = { page: 1, limit: 20 };
      const result = await controller.getArchiveTimeline(STUDENT_ID, paginationQuery, mockRequest);

      expect(result).toEqual(paginatedTimeline);
      expect(mockArchiveService.getArchiveTimeline).toHaveBeenCalledWith(
        STUDENT_ID,
        mockUser.id,
        mockUser.role,
        paginationQuery,
      );
    });

    it('retourne les métadonnées de pagination dans la vue timeline', async () => {
      const paginatedTimeline = {
        data: [],
        page: 3,
        limit: 5,
        total: 12,
        totalPages: 3,
      };
      mockArchiveService.getArchiveTimeline.mockResolvedValue(paginatedTimeline);

      const result = await controller.getArchiveTimeline(
        STUDENT_ID,
        { page: 3, limit: 5 },
        mockRequest,
      );

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(3);
    });
  });

  // ─── downloadArchiveDocument ────────────────────────────────────────────────

  describe('GET /archive-documents/:id/download', () => {
    it('retourne l\'URL de redirection pour téléchargement', async () => {
      mockArchiveService.getArchiveItemForDownload.mockResolvedValue(mockArchiveItem);

      const result = await controller.downloadArchiveDocument(mockArchiveItem.id, mockRequest);

      expect(result).toEqual({ url: mockArchiveItem.downloadUrl });
      expect(mockArchiveService.getArchiveItemForDownload).toHaveBeenCalledWith(
        mockArchiveItem.id,
        mockUser.id,
        mockUser.role,
      );
    });

    it('propage NotFoundException si l\'élément n\'existe pas', async () => {
      mockArchiveService.getArchiveItemForDownload.mockRejectedValue(
        new NotFoundException('Élément non trouvé'),
      );

      await expect(
        controller.downloadArchiveDocument('nonexistent-id', mockRequest),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage ForbiddenException pour le carnet personnel (parent)', async () => {
      mockArchiveService.getArchiveItemForDownload.mockRejectedValue(
        new ForbiddenException('Carnet personnel non accessible'),
      );

      await expect(
        controller.downloadArchiveDocument('carnet-item-id', {
          user: { ...mockUser, role: UserRole.PARENT_FINANCEUR },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
