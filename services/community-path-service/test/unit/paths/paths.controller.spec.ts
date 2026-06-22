/**
 * Unit tests — PathsController & PathEnrollmentsController
 *
 * Couvre :
 *   - POST /paths                       → créer un parcours (RP/AP)
 *   - GET  /paths                       → lister les parcours selon rôle
 *   - POST /paths/:id/validate          → valider un parcours AP (RP seulement)
 *   - POST /paths/:id/enrollments       → inscrire l'élève courant
 *   - PATCH /path-enrollments/:id/progress → mettre à jour la progression
 *   - Propagation des exceptions du service
 *
 * Les guards JwtAuthGuard et RolesGuard sont mockés pour isoler les contrôleurs.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PathsController, PathEnrollmentsController } from '../../../src/paths/paths.controller';
import { PathsService } from '../../../src/paths/paths.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { CreatePathDto } from '../../../src/paths/dto/create-path.dto';
import { UpdateEnrollmentProgressDto } from '../../../src/paths/dto/update-enrollment-progress.dto';
import { PathStatus } from '../../../src/common/enums/path-status.enum';
import { EnrollmentStatus } from '../../../src/common/enums/enrollment-status.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

// ─── Mock du service ──────────────────────────────────────────────────────────

const mockPathsService = {
  createPath: jest.fn(),
  findAllPaths: jest.fn(),
  validatePath: jest.fn(),
  enrollStudent: jest.fn(),
  updateEnrollmentProgress: jest.fn(),
};

// Guards mockés pour isoler les contrôleurs des dépendances externes
const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RP_ID = 'rp-0000-4000-a000-aaaaaaaaaaaa';
const AP_ID = 'ap-0000-4000-b000-bbbbbbbbbbbb';
const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const PATH_ID = 'pa-0000-4000-0000-000000000000';
const ENROLLMENT_ID = 'en-0000-4000-0000-000000000000';

const rpUser = { id: RP_ID, email: 'rp@example.com', role: UserRole.RESPONSABLE_PEDAGOGIQUE, validationStatus: 'active', jti: 'jti-rp' };
const apUser = { id: AP_ID, email: 'ap@example.com', role: UserRole.ANIMATEUR_PEDAGOGIQUE, validationStatus: 'active', jti: 'jti-ap' };
const eleveUser = { id: ELEVE_ID, email: 'eleve@example.com', role: UserRole.ELEVE, validationStatus: 'active', jti: 'jti-eleve' };

const mockPath = {
  id: PATH_ID,
  title: 'Parcours Algèbre Seconde',
  description: 'Parcours complet algèbre',
  status: PathStatus.VALIDATED,
  createdById: RP_ID,
  createdByRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
  steps: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const mockEnrollment = {
  id: ENROLLMENT_ID,
  learningPathId: PATH_ID,
  studentId: ELEVE_ID,
  status: EnrollmentStatus.IN_PROGRESS,
  progressPercent: 0,
  enrolledAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

// ─── Tests PathsController ────────────────────────────────────────────────────

describe('PathsController', () => {
  let controller: PathsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PathsController],
      providers: [
        { provide: PathsService, useValue: mockPathsService },
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

    controller = module.get<PathsController>(PathsController);
    jest.clearAllMocks();
  });

  // ─── POST /paths ──────────────────────────────────────────────────────────────

  describe('POST /paths — createPath()', () => {
    const createPathDto: CreatePathDto = {
      title: 'Parcours Algèbre Seconde',
      description: 'Parcours complet algèbre niveau seconde',
    };

    it('délègue au service avec le DTO, l\'id et le rôle du créateur RP', async () => {
      mockPathsService.createPath.mockResolvedValue(mockPath);

      const result = await controller.createPath(createPathDto, rpUser);

      expect(mockPathsService.createPath).toHaveBeenCalledWith(
        createPathDto,
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result).toEqual(mockPath);
    });

    it('délègue au service avec le rôle AP — parcours en attente de validation', async () => {
      const pendingPath = { ...mockPath, status: PathStatus.PENDING_VALIDATION, createdById: AP_ID };
      mockPathsService.createPath.mockResolvedValue(pendingPath);

      const result = await controller.createPath(createPathDto, apUser);

      expect(mockPathsService.createPath).toHaveBeenCalledWith(
        createPathDto,
        AP_ID,
        UserRole.ANIMATEUR_PEDAGOGIQUE,
      );
      expect(result.status).toBe(PathStatus.PENDING_VALIDATION);
    });

    it('propage ForbiddenException si le service rejette le rôle', async () => {
      mockPathsService.createPath.mockRejectedValue(
        new ForbiddenException('Seuls les RP et AP peuvent créer des parcours'),
      );

      await expect(
        controller.createPath(createPathDto, eleveUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── GET /paths ───────────────────────────────────────────────────────────────

  describe('GET /paths — findAllPaths()', () => {
    it('délègue au service avec le rôle de l\'utilisateur courant', async () => {
      mockPathsService.findAllPaths.mockResolvedValue([mockPath]);

      const result = await controller.findAllPaths(rpUser);

      expect(mockPathsService.findAllPaths).toHaveBeenCalledWith(
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result).toEqual([mockPath]);
    });

    it('retourne une liste filtrée aux parcours validés pour un élève', async () => {
      mockPathsService.findAllPaths.mockResolvedValue([mockPath]);

      const result = await controller.findAllPaths(eleveUser);

      expect(mockPathsService.findAllPaths).toHaveBeenCalledWith(UserRole.ELEVE);
      expect(result).toHaveLength(1);
    });

    it('retourne une liste vide si aucun parcours validé n\'existe pour un élève', async () => {
      mockPathsService.findAllPaths.mockResolvedValue([]);

      const result = await controller.findAllPaths(eleveUser);

      expect(result).toEqual([]);
    });
  });

  // ─── POST /paths/:id/validate ─────────────────────────────────────────────────

  describe('POST /paths/:id/validate — validatePath()', () => {
    it('délègue au service avec pathId, userId et rôle RP', async () => {
      const validatedPath = { ...mockPath, status: PathStatus.VALIDATED };
      mockPathsService.validatePath.mockResolvedValue(validatedPath);

      const result = await controller.validatePath(PATH_ID, rpUser);

      expect(mockPathsService.validatePath).toHaveBeenCalledWith(
        PATH_ID,
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );
      expect(result.status).toBe(PathStatus.VALIDATED);
    });

    it('propage ForbiddenException si un AP tente de valider un parcours', async () => {
      mockPathsService.validatePath.mockRejectedValue(
        new ForbiddenException('Seul un RP peut valider un parcours'),
      );

      await expect(
        controller.validatePath(PATH_ID, apUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage BadRequestException si le parcours n\'est pas en attente de validation', async () => {
      mockPathsService.validatePath.mockRejectedValue(
        new BadRequestException('Ce parcours n\'est pas en attente de validation'),
      );

      await expect(
        controller.validatePath(PATH_ID, rpUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage NotFoundException si le parcours est introuvable', async () => {
      mockPathsService.validatePath.mockRejectedValue(
        new NotFoundException(`Parcours ${PATH_ID} introuvable`),
      );

      await expect(
        controller.validatePath(PATH_ID, rpUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── POST /paths/:id/enrollments ──────────────────────────────────────────────

  describe('POST /paths/:id/enrollments — enrollStudent()', () => {
    it('délègue au service avec pathId, userId et rôle élève', async () => {
      mockPathsService.enrollStudent.mockResolvedValue(mockEnrollment);

      const result = await controller.enrollStudent(PATH_ID, eleveUser);

      expect(mockPathsService.enrollStudent).toHaveBeenCalledWith(
        PATH_ID,
        ELEVE_ID,
        UserRole.ELEVE,
      );
      expect(result).toEqual(mockEnrollment);
    });

    it('propage BadRequestException si l\'élève a déjà 3 parcours ouverts', async () => {
      mockPathsService.enrollStudent.mockRejectedValue(
        new BadRequestException('Vous ne pouvez pas avoir plus de 3 parcours ouverts simultanément'),
      );

      await expect(
        controller.enrollStudent(PATH_ID, eleveUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage BadRequestException si l\'élève est déjà inscrit à ce parcours', async () => {
      mockPathsService.enrollStudent.mockRejectedValue(
        new BadRequestException('Vous êtes déjà inscrit à ce parcours'),
      );

      await expect(
        controller.enrollStudent(PATH_ID, eleveUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage BadRequestException si le parcours n\'est pas validé', async () => {
      mockPathsService.enrollStudent.mockRejectedValue(
        new BadRequestException('Ce parcours n\'est pas disponible pour l\'inscription'),
      );

      await expect(
        controller.enrollStudent(PATH_ID, eleveUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage NotFoundException si le parcours est introuvable', async () => {
      mockPathsService.enrollStudent.mockRejectedValue(
        new NotFoundException(`Parcours ${PATH_ID} introuvable`),
      );

      await expect(
        controller.enrollStudent(PATH_ID, eleveUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

// ─── Tests PathEnrollmentsController ─────────────────────────────────────────

describe('PathEnrollmentsController', () => {
  let controller: PathEnrollmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PathEnrollmentsController],
      providers: [
        { provide: PathsService, useValue: mockPathsService },
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

    controller = module.get<PathEnrollmentsController>(PathEnrollmentsController);
    jest.clearAllMocks();
  });

  // ─── PATCH /path-enrollments/:id/progress ──────────────────────────────────

  describe('PATCH /path-enrollments/:id/progress — updateProgress()', () => {
    const updateDto: UpdateEnrollmentProgressDto = { completedStepId: 'step-001' };

    it('délègue au service avec enrollmentId, dto et userId', async () => {
      const updatedEnrollment = { ...mockEnrollment, progressPercent: 50 };
      mockPathsService.updateEnrollmentProgress.mockResolvedValue(updatedEnrollment);

      const result = await controller.updateProgress(ENROLLMENT_ID, updateDto, eleveUser);

      expect(mockPathsService.updateEnrollmentProgress).toHaveBeenCalledWith(
        ENROLLMENT_ID,
        updateDto,
        ELEVE_ID,
      );
      expect(result.progressPercent).toBe(50);
    });

    it('retourne le statut COMPLETED et le certificat si progression à 100%', async () => {
      const completedEnrollment = {
        ...mockEnrollment,
        progressPercent: 100,
        status: EnrollmentStatus.COMPLETED,
      };
      mockPathsService.updateEnrollmentProgress.mockResolvedValue(completedEnrollment);

      const result = await controller.updateProgress(ENROLLMENT_ID, updateDto, eleveUser);

      expect(result.status).toBe(EnrollmentStatus.COMPLETED);
      expect(result.progressPercent).toBe(100);
    });

    it('propage ForbiddenException si l\'utilisateur n\'est pas propriétaire de l\'inscription', async () => {
      mockPathsService.updateEnrollmentProgress.mockRejectedValue(
        new ForbiddenException('Vous ne pouvez mettre à jour que votre propre progression'),
      );

      await expect(
        controller.updateProgress(ENROLLMENT_ID, updateDto, rpUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propage BadRequestException si le parcours est déjà terminé', async () => {
      mockPathsService.updateEnrollmentProgress.mockRejectedValue(
        new BadRequestException('Ce parcours est déjà terminé'),
      );

      await expect(
        controller.updateProgress(ENROLLMENT_ID, updateDto, eleveUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('propage NotFoundException si l\'inscription est introuvable', async () => {
      mockPathsService.updateEnrollmentProgress.mockRejectedValue(
        new NotFoundException(`Inscription ${ENROLLMENT_ID} introuvable`),
      );

      await expect(
        controller.updateProgress(ENROLLMENT_ID, updateDto, eleveUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
