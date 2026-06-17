import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalController } from '../../../src/internal/internal.controller';
import { ArchiveService } from '../../../src/archive/archive.service';
import { InternalSecretGuard } from '../../../src/common/guards/internal-secret.guard';
import { ArchiveItemType } from '../../../src/common/enums/archive-item-type.enum';

const mockInternalSecretGuard = { canActivate: jest.fn().mockReturnValue(true) };

// ─── Mock du service ──────────────────────────────────────────────────────────

const mockArchiveService = {
  listArchivesInternal: jest.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-uuid-1';

const mockArchiveItems = [
  {
    id: 'item-uuid-1',
    studentId: STUDENT_ID,
    itemType: ArchiveItemType.RESUME_DE_COURS,
    sourceId: 'session-uuid-1',
    sourceService: 'video-session-service',
    title: 'Résumé — Algèbre',
    occurredAt: new Date('2026-06-12T14:00:00Z'),
    pedagogicalPoints: 10,
    isParentVisible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'item-uuid-2',
    studentId: STUDENT_ID,
    itemType: ArchiveItemType.CARNET_PERSONNEL,
    sourceId: 'carnet-uuid-1',
    sourceService: 'pedagogical-log-service',
    title: 'Mon journal',
    occurredAt: new Date('2026-06-10T09:00:00Z'),
    pedagogicalPoints: 0,
    isParentVisible: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InternalController', () => {
  let controller: InternalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: ArchiveService, useValue: mockArchiveService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(InternalSecretGuard)
      .useValue(mockInternalSecretGuard)
      .compile();

    controller = module.get<InternalController>(InternalController);
    jest.clearAllMocks();
  });

  describe('GET /internal/students/:studentId/archives', () => {
    it('retourne toutes les archives d\'un élève sans filtrage de rôle', async () => {
      mockArchiveService.listArchivesInternal.mockResolvedValue(mockArchiveItems);

      const result = await controller.listArchivesInternal(STUDENT_ID);

      expect(result).toEqual(mockArchiveItems);
      expect(mockArchiveService.listArchivesInternal).toHaveBeenCalledWith(STUDENT_ID);
    });

    it('inclut le carnet personnel dans le résultat (pas de filtrage interne)', async () => {
      mockArchiveService.listArchivesInternal.mockResolvedValue(mockArchiveItems);

      const result = await controller.listArchivesInternal(STUDENT_ID) as typeof mockArchiveItems;

      const carnetItems = result.filter((item) => item.itemType === ArchiveItemType.CARNET_PERSONNEL);
      expect(carnetItems).toHaveLength(1);
    });

    it('retourne un tableau vide si l\'élève n\'a pas d\'archives', async () => {
      mockArchiveService.listArchivesInternal.mockResolvedValue([]);

      const result = await controller.listArchivesInternal(STUDENT_ID);

      expect(result).toEqual([]);
    });
  });
});
