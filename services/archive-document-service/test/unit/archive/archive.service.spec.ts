import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ArchiveService } from '../../../src/archive/archive.service';
import { ArchiveItem } from '../../../src/archive/entities/archive-item.entity';
import { AddArchiveLinkDto } from '../../../src/archive/dto/add-archive-link.dto';
import { ArchiveItemType } from '../../../src/common/enums/archive-item-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

// ─── Mock du repository ────────────────────────────────────────────────────────

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  getCount: jest.fn(),
};

const mockArchiveItemRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-uuid-1';
const ANOTHER_STUDENT_ID = 'student-uuid-2';
const PARENT_ID = 'parent-uuid-1';
const FORMATEUR_ID = 'formateur-uuid-1';
const RP_ID = 'rp-uuid-1';
const TI_ID = 'ti-uuid-1';
const AF_ID = 'af-uuid-1';

const baseArchiveItem: ArchiveItem = {
  id: 'item-uuid-1',
  studentId: STUDENT_ID,
  itemType: ArchiveItemType.RESUME_DE_COURS,
  sourceId: 'session-uuid-1',
  sourceService: 'video-session-service',
  title: 'Résumé — Algèbre 12/06/2026',
  description: 'Résumé du cours de rattrapage',
  downloadUrl: 'https://storage.example.com/resumes/session-uuid-1.pdf',
  score: null,
  pedagogicalPoints: 10,
  occurredAt: new Date('2026-06-12T14:00:00Z'),
  isParentVisible: true,
  idempotencyKey: null,
  createdAt: new Date('2026-06-12T16:00:00Z'),
  updatedAt: new Date('2026-06-12T16:00:00Z'),
};

const carnetPersonnelItem: ArchiveItem = {
  ...baseArchiveItem,
  id: 'item-uuid-2',
  itemType: ArchiveItemType.CARNET_PERSONNEL,
  title: 'Mon journal personnel',
  downloadUrl: null,
  isParentVisible: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArchiveService', () => {
  let service: ArchiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
        { provide: getRepositoryToken(ArchiveItem), useValue: mockArchiveItemRepo },
      ],
    }).compile();

    service = module.get<ArchiveService>(ArchiveService);
    jest.clearAllMocks();

    // Réinitialiser le queryBuilder mock
    mockArchiveItemRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.getMany.mockResolvedValue([]);
    mockQueryBuilder.getCount.mockResolvedValue(0);
  });

  // ─── listPedagogicalArchives ────────────────────────────────────────────────

  describe('listPedagogicalArchives', () => {
    it('permet à un élève d\'accéder à ses propres archives', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toEqual([baseArchiveItem]);
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'item.studentId = :studentId',
        { studentId: STUDENT_ID },
      );
    });

    it('retourne les métadonnées de pagination correctes', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(42);

      const result = await service.listPedagogicalArchives(
        STUDENT_ID,
        STUDENT_ID,
        UserRole.ELEVE,
        { page: 2, limit: 10 },
      );

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(42);
      expect(result.totalPages).toBe(5);
    });

    it('utilise les valeurs de pagination par défaut (page=1, limit=20)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      mockQueryBuilder.getCount.mockResolvedValue(0);

      const result = await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('refuse l\'accès à un élève qui tente de consulter les archives d\'un autre élève', async () => {
      await expect(
        service.listPedagogicalArchives(STUDENT_ID, ANOTHER_STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permet au parent financeur d\'accéder aux archives de l\'élève lié', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.listPedagogicalArchives(STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR);

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('exclut le carnet personnel pour le parent financeur (spec XML : règle parent)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      await service.listPedagogicalArchives(STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.itemType != :carnetType',
        { carnetType: ArchiveItemType.CARNET_PERSONNEL },
      );
    });

    it('n\'exclut pas le carnet personnel pour l\'élève lui-même', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem, carnetPersonnelItem]);
      mockQueryBuilder.getCount.mockResolvedValue(2);

      await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('permet au formateur d\'accéder aux archives des élèves rattachés', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.listPedagogicalArchives(STUDENT_ID, FORMATEUR_ID, UserRole.FORMATEUR);

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('permet au RP d\'accéder aux archives de n\'importe quel élève (accès pédagogique large)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await service.listPedagogicalArchives(STUDENT_ID, RP_ID, UserRole.RESPONSABLE_PEDAGOGIQUE);

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('permet au TI d\'accéder aux archives (accès incident)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      mockQueryBuilder.getCount.mockResolvedValue(0);

      await expect(
        service.listPedagogicalArchives(STUDENT_ID, TI_ID, UserRole.TECHNICIEN_INFORMATIQUE),
      ).resolves.toBeDefined();
    });

    it('permet à l\'AF d\'accéder aux archives (contrôle financier)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      mockQueryBuilder.getCount.mockResolvedValue(0);

      await expect(
        service.listPedagogicalArchives(STUDENT_ID, AF_ID, UserRole.ADMINISTRATEUR_FINANCIER),
      ).resolves.toBeDefined();
    });

    it('refuse l\'accès à l\'animateur pédagogique (non listé dans les règles d\'accès)', async () => {
      await expect(
        service.listPedagogicalArchives(STUDENT_ID, 'ap-uuid-1', UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── addArchiveLink ─────────────────────────────────────────────────────────

  describe('addArchiveLink', () => {
    const addDto: AddArchiveLinkDto = {
      itemType: ArchiveItemType.RESUME_DE_COURS,
      sourceId: 'session-uuid-1',
      sourceService: 'video-session-service',
      title: 'Résumé — Algèbre',
      occurredAt: '2026-06-12T14:00:00Z',
      pedagogicalPoints: 10,
    };

    it('crée un élément archive et le retourne', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(null);
      mockArchiveItemRepo.create.mockReturnValue(baseArchiveItem);
      mockArchiveItemRepo.save.mockResolvedValue(baseArchiveItem);

      const result = await service.addArchiveLink(STUDENT_ID, addDto);

      expect(result).toEqual(baseArchiveItem);
      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          itemType: ArchiveItemType.RESUME_DE_COURS,
          sourceId: 'session-uuid-1',
        }),
      );
      expect(mockArchiveItemRepo.save).toHaveBeenCalled();
    });

    it('force isParentVisible à false pour les éléments de type carnet_personnel (spec XML)', async () => {
      const carnetDto: AddArchiveLinkDto = {
        ...addDto,
        itemType: ArchiveItemType.CARNET_PERSONNEL,
        isParentVisible: true, // Tentative de forcer à true — doit être ignorée
      };

      mockArchiveItemRepo.findOne.mockResolvedValue(null);
      mockArchiveItemRepo.create.mockReturnValue({ ...carnetPersonnelItem });
      mockArchiveItemRepo.save.mockResolvedValue({ ...carnetPersonnelItem });

      await service.addArchiveLink(STUDENT_ID, carnetDto);

      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isParentVisible: false }),
      );
    });

    it('retourne l\'élément existant quand la clé d\'idempotence est déjà utilisée (même élève)', async () => {
      const dtoWithIdempotencyKey: AddArchiveLinkDto = {
        ...addDto,
        idempotencyKey: 'unique-key-123',
      };
      const existingItem = { ...baseArchiveItem, idempotencyKey: 'unique-key-123' };
      mockArchiveItemRepo.findOne.mockResolvedValue(existingItem);

      const result = await service.addArchiveLink(STUDENT_ID, dtoWithIdempotencyKey);

      expect(result).toEqual(existingItem);
      expect(mockArchiveItemRepo.save).not.toHaveBeenCalled();
    });

    it('lève ConflictException si la clé d\'idempotence appartient à un autre élève', async () => {
      const dtoWithIdempotencyKey: AddArchiveLinkDto = {
        ...addDto,
        idempotencyKey: 'unique-key-123',
      };
      const existingItemOtherStudent = { ...baseArchiveItem, studentId: ANOTHER_STUDENT_ID, idempotencyKey: 'unique-key-123' };
      mockArchiveItemRepo.findOne.mockResolvedValue(existingItemOtherStudent);

      await expect(
        service.addArchiveLink(STUDENT_ID, dtoWithIdempotencyKey),
      ).rejects.toThrow(ConflictException);
    });

    it('initialise pedagogicalPoints à 0 si non fourni', async () => {
      const dtoWithoutPoints: AddArchiveLinkDto = {
        ...addDto,
        pedagogicalPoints: undefined,
      };
      mockArchiveItemRepo.findOne.mockResolvedValue(null);
      mockArchiveItemRepo.create.mockReturnValue({ ...baseArchiveItem, pedagogicalPoints: 0 });
      mockArchiveItemRepo.save.mockResolvedValue({ ...baseArchiveItem, pedagogicalPoints: 0 });

      await service.addArchiveLink(STUDENT_ID, dtoWithoutPoints);

      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pedagogicalPoints: 0 }),
      );
    });

    it('ne vérifie pas la clé d\'idempotence quand elle est absente', async () => {
      mockArchiveItemRepo.create.mockReturnValue(baseArchiveItem);
      mockArchiveItemRepo.save.mockResolvedValue(baseArchiveItem);

      await service.addArchiveLink(STUDENT_ID, addDto);

      expect(mockArchiveItemRepo.findOne).not.toHaveBeenCalled();
    });
  });

  // ─── getArchiveTimeline ─────────────────────────────────────────────────────

  describe('getArchiveTimeline', () => {
    it('retourne les archives groupées par date avec pagination', async () => {
      const item1 = { ...baseArchiveItem, occurredAt: new Date('2026-06-12T14:00:00Z') };
      const item2 = {
        ...baseArchiveItem,
        id: 'item-uuid-3',
        occurredAt: new Date('2026-06-15T10:00:00Z'),
        title: 'Exercice algèbre',
        itemType: ArchiveItemType.EXERCICE_EVALUATION,
      };
      mockQueryBuilder.getMany.mockResolvedValue([item1, item2]);

      const result = await service.getArchiveTimeline(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].date).toBe('2026-06-12');
      expect(result.data[1].date).toBe('2026-06-15');
      expect(result.total).toBe(2);
    });

    it('retourne les métadonnées de pagination correctes pour la timeline', async () => {
      const items = Array.from({ length: 5 }, (_, index) => ({
        ...baseArchiveItem,
        id: `item-uuid-${index}`,
        occurredAt: new Date(`2026-06-${String(index + 1).padStart(2, '0')}T14:00:00Z`),
      }));
      mockQueryBuilder.getMany.mockResolvedValue(items);

      const result = await service.getArchiveTimeline(
        STUDENT_ID,
        STUDENT_ID,
        UserRole.ELEVE,
        { page: 1, limit: 2 },
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('regroupe plusieurs éléments de la même date', async () => {
      const item1 = { ...baseArchiveItem, occurredAt: new Date('2026-06-12T08:00:00Z') };
      const item2 = {
        ...baseArchiveItem,
        id: 'item-uuid-3',
        occurredAt: new Date('2026-06-12T14:00:00Z'),
        title: 'Exercice du matin',
      };
      mockQueryBuilder.getMany.mockResolvedValue([item1, item2]);

      const result = await service.getArchiveTimeline(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].date).toBe('2026-06-12');
      expect(result.data[0].items).toHaveLength(2);
    });

    it('refuse l\'accès à un élève consultant les archives d\'un autre élève', async () => {
      await expect(
        service.getArchiveTimeline(STUDENT_ID, ANOTHER_STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('exclut le carnet personnel pour le parent (spec XML : règle parent)', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.getArchiveTimeline(STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.itemType != :carnetType',
        { carnetType: ArchiveItemType.CARNET_PERSONNEL },
      );
    });
  });

  // ─── getArchiveItemForDownload ──────────────────────────────────────────────

  describe('getArchiveItemForDownload', () => {
    it('retourne l\'élément archive avec son URL de téléchargement', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(baseArchiveItem);

      const result = await service.getArchiveItemForDownload(
        baseArchiveItem.id,
        STUDENT_ID,
        UserRole.ELEVE,
      );

      expect(result).toEqual(baseArchiveItem);
    });

    it('lève NotFoundException si l\'élément n\'existe pas', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getArchiveItemForDownload('nonexistent-id', STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si le parent tente de télécharger le carnet personnel (spec XML)', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(carnetPersonnelItem);

      await expect(
        service.getArchiveItemForDownload(carnetPersonnelItem.id, PARENT_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si l\'élément n\'a pas d\'URL de téléchargement', async () => {
      const itemWithoutDownload = { ...baseArchiveItem, downloadUrl: null };
      mockArchiveItemRepo.findOne.mockResolvedValue(itemWithoutDownload);

      await expect(
        service.getArchiveItemForDownload(itemWithoutDownload.id, STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si l\'élève tente d\'accéder aux archives d\'un autre élève', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(baseArchiveItem); // studentId = STUDENT_ID

      await expect(
        service.getArchiveItemForDownload(
          baseArchiveItem.id,
          ANOTHER_STUDENT_ID,
          UserRole.ELEVE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permet au RP de télécharger n\'importe quel document (accès large)', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(baseArchiveItem);

      const result = await service.getArchiveItemForDownload(
        baseArchiveItem.id,
        RP_ID,
        UserRole.RESPONSABLE_PEDAGOGIQUE,
      );

      expect(result).toEqual(baseArchiveItem);
    });
  });

  // ─── listArchivesInternal ───────────────────────────────────────────────────

  describe('listArchivesInternal', () => {
    it('retourne toutes les archives d\'un élève sans filtrage', async () => {
      const allItems = [baseArchiveItem, carnetPersonnelItem];
      mockArchiveItemRepo.find.mockResolvedValue(allItems);

      const result = await service.listArchivesInternal(STUDENT_ID);

      expect(result).toEqual(allItems);
      expect(mockArchiveItemRepo.find).toHaveBeenCalledWith({
        where: { studentId: STUDENT_ID },
        order: { occurredAt: 'DESC' },
      });
    });
  });
});
