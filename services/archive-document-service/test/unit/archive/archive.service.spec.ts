import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ArchiveService } from '../../../src/archive/archive.service';
import { ArchiveItem } from '../../../src/archive/entities/archive-item.entity';
import { AddArchiveLinkDto } from '../../../src/archive/dto/add-archive-link.dto';
import { ArchiveItemType } from '../../../src/common/enums/archive-item-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../src/common/clients/profile-relations.client';
import { RelationKind, ResolvedRelation } from '../../../src/common/relations/relation-kind';

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

const mockProfileRelationsClient = {
  resolveRelations: jest.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STUDENT_ID = 'student-uuid-1';
const ANOTHER_STUDENT_ID = 'student-uuid-2';
const PARENT_ID = 'parent-uuid-1';
const FORMATEUR_ID = 'formateur-uuid-1';
const AP_ID = 'ap-uuid-1';
const RP_ID = 'rp-uuid-1';

/** Réponse type de `GET /internal/relations/:viewerId/:targetId`. */
function relationSnapshot(options: {
  viewerId: string;
  targetId: string;
  isSelf?: boolean;
  isAdministrator?: boolean;
  relations?: ResolvedRelation[];
}) {
  return {
    viewerId: options.viewerId,
    targetId: options.targetId,
    isSelf: options.isSelf ?? false,
    isAdministrator: options.isAdministrator ?? false,
    relations: options.relations ?? [],
  };
}

function givenRelations(relations: ResolvedRelation[], viewerId = FORMATEUR_ID) {
  mockProfileRelationsClient.resolveRelations.mockResolvedValue(
    relationSnapshot({ viewerId, targetId: STUDENT_ID, relations }),
  );
}

function givenSelf(userId: string) {
  mockProfileRelationsClient.resolveRelations.mockResolvedValue(
    relationSnapshot({ viewerId: userId, targetId: userId, isSelf: true }),
  );
}

function givenAdministrator(viewerId: string, targetId: string) {
  mockProfileRelationsClient.resolveRelations.mockResolvedValue(
    relationSnapshot({ viewerId, targetId, isAdministrator: true }),
  );
}

function givenNoRelation(viewerId: string, targetId: string) {
  mockProfileRelationsClient.resolveRelations.mockResolvedValue(
    relationSnapshot({ viewerId, targetId, relations: [] }),
  );
}

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

/** Message unique : « aucune archive » et « aucun droit » sont indiscernables. */
const NO_ARCHIVE_MESSAGE = 'Aucune archive pédagogique accessible pour cette personne';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ArchiveService', () => {
  let service: ArchiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
        { provide: getRepositoryToken(ArchiveItem), useValue: mockArchiveItemRepo },
        { provide: ProfileRelationsClient, useValue: mockProfileRelationsClient },
      ],
    }).compile();

    service = module.get<ArchiveService>(ArchiveService);
    jest.clearAllMocks();

    mockArchiveItemRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.getMany.mockResolvedValue([baseArchiveItem]);
    mockQueryBuilder.getCount.mockResolvedValue(1);
  });

  // ─── listPedagogicalArchives : cas nominaux ─────────────────────────────────

  describe('listPedagogicalArchives — accès autorisé', () => {
    it('le titulaire accède à ses propres archives', async () => {
      givenSelf(STUDENT_ID);

      const result = await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toEqual([baseArchiveItem]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('item.studentId = :studentId', {
        studentId: STUDENT_ID,
      });
    });

    it('le formateur accède aux archives de SON élève (teacher_of_student)', async () => {
      givenRelations([{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }]);

      const result = await service.listPedagogicalArchives(
        STUDENT_ID,
        FORMATEUR_ID,
        UserRole.FORMATEUR,
      );

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('le parent financeur accède aux archives de SON élève (finance_owner_of_student)', async () => {
      givenRelations([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }], PARENT_ID);

      const result = await service.listPedagogicalArchives(
        STUDENT_ID,
        PARENT_ID,
        UserRole.PARENT_FINANCEUR,
      );

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('l\'AP accède aux archives du formateur qu\'il anime (animator_of_teacher)', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        relationSnapshot({
          viewerId: AP_ID,
          targetId: FORMATEUR_ID,
          relations: [{ kind: RelationKind.ANIMATOR_OF_TEACHER }],
        }),
      );

      const result = await service.listPedagogicalArchives(
        FORMATEUR_ID,
        AP_ID,
        UserRole.ANIMATEUR_PEDAGOGIQUE,
      );

      expect(result.data).toEqual([baseArchiveItem]);
    });

    it('le coordinateur accède aux archives de l\'élève qu\'il coordonne', async () => {
      givenRelations([{ kind: RelationKind.COORDINATOR_OF_STUDENT }], AP_ID);

      await expect(
        service.listPedagogicalArchives(STUDENT_ID, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it.each([
      [UserRole.RESPONSABLE_PEDAGOGIQUE],
      [UserRole.TECHNICIEN_INFORMATIQUE],
      [UserRole.ADMINISTRATEUR_FINANCIER],
    ])('un administrateur (%s) accède aux archives de tout le monde', async (role) => {
      givenAdministrator(RP_ID, STUDENT_ID);

      await expect(
        service.listPedagogicalArchives(STUDENT_ID, RP_ID, role),
      ).resolves.toBeDefined();
    });

    it('transmet le rôle du demandeur à profile-service, qui l\'exige', async () => {
      givenRelations([{ kind: RelationKind.TEACHER_OF_STUDENT }]);

      await service.listPedagogicalArchives(
        STUDENT_ID,
        FORMATEUR_ID,
        UserRole.FORMATEUR,
        undefined,
        'correlation-abc',
      );

      expect(mockProfileRelationsClient.resolveRelations).toHaveBeenCalledWith(
        FORMATEUR_ID,
        STUDENT_ID,
        UserRole.FORMATEUR,
        'correlation-abc',
      );
    });

    it('retourne les métadonnées de pagination correctes', async () => {
      givenSelf(STUDENT_ID);
      mockQueryBuilder.getCount.mockResolvedValue(42);

      const result = await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE, {
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(42);
      expect(result.totalPages).toBe(5);
    });

    it('utilise les valeurs de pagination par défaut (page=1, limit=20)', async () => {
      givenSelf(STUDENT_ID);

      const result = await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });
  });

  // ─── listPedagogicalArchives : cas de refus ─────────────────────────────────

  describe('listPedagogicalArchives — accès refusé', () => {
    it('REFUSE à l\'élève les archives de SON formateur (student_of_teacher)', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        relationSnapshot({
          viewerId: STUDENT_ID,
          targetId: FORMATEUR_ID,
          relations: [{ kind: RelationKind.STUDENT_OF_TEACHER, isPrincipalTeacher: true }],
        }),
      );

      await expect(
        service.listPedagogicalArchives(FORMATEUR_ID, STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(new NotFoundException(NO_ARCHIVE_MESSAGE));
    });

    it('REFUSE au parent les archives du formateur de son élève (finance_owner_of_student_of_teacher)', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        relationSnapshot({
          viewerId: PARENT_ID,
          targetId: FORMATEUR_ID,
          relations: [
            {
              kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
              throughUserIds: [STUDENT_ID],
            },
          ],
        }),
      );

      await expect(
        service.listPedagogicalArchives(FORMATEUR_ID, PARENT_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(new NotFoundException(NO_ARCHIVE_MESSAGE));
    });

    it('refuse un élève qui consulte les archives d\'un autre élève', async () => {
      givenNoRelation(STUDENT_ID, ANOTHER_STUDENT_ID);

      await expect(
        service.listPedagogicalArchives(ANOTHER_STUDENT_ID, STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un formateur sur un élève qui ne lui est pas rattaché', async () => {
      givenNoRelation(FORMATEUR_ID, ANOTHER_STUDENT_ID);

      await expect(
        service.listPedagogicalArchives(ANOTHER_STUDENT_ID, FORMATEUR_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un parent financeur sur un élève d\'une autre famille', async () => {
      givenNoRelation(PARENT_ID, ANOTHER_STUDENT_ID);

      await expect(
        service.listPedagogicalArchives(ANOTHER_STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuse un AP sans lien animator_of_teacher — son rôle seul n\'ouvre rien', async () => {
      givenNoRelation(AP_ID, FORMATEUR_ID);

      await expect(
        service.listPedagogicalArchives(FORMATEUR_ID, AP_ID, UserRole.ANIMATEUR_PEDAGOGIQUE),
      ).rejects.toThrow(NotFoundException);
    });

    it('ne touche PAS la base quand l\'accès est refusé (contrôle avant lecture)', async () => {
      givenNoRelation(PARENT_ID, ANOTHER_STUDENT_ID);

      await expect(
        service.listPedagogicalArchives(ANOTHER_STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(NotFoundException);

      expect(mockArchiveItemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('répond le MÊME message qu\'une archive vide — les deux cas sont indiscernables', async () => {
      givenNoRelation(PARENT_ID, ANOTHER_STUDENT_ID);
      const refusal = await service
        .listPedagogicalArchives(ANOTHER_STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR)
        .catch((error) => error);

      jest.clearAllMocks();
      mockArchiveItemRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getCount.mockResolvedValue(0);
      givenSelf(STUDENT_ID);
      const emptiness = await service
        .listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE)
        .catch((error) => error);

      expect(refusal).toBeInstanceOf(NotFoundException);
      expect(emptiness).toBeInstanceOf(NotFoundException);
      expect(refusal.message).toBe(emptiness.message);
      expect(refusal.message).toBe(NO_ARCHIVE_MESSAGE);
    });

    it('ne cite aucun identifiant technique dans le message de refus', async () => {
      givenNoRelation(PARENT_ID, ANOTHER_STUDENT_ID);

      const error = await service
        .listPedagogicalArchives(ANOTHER_STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR)
        .catch((thrown) => thrown);

      expect(error.message).not.toContain(ANOTHER_STUDENT_ID);
      expect(error.message).not.toContain(PARENT_ID);
    });

    it('échoue en 503 quand profile-service est injoignable — jamais d\'ouverture par défaut', async () => {
      mockProfileRelationsClient.resolveRelations.mockRejectedValue(
        new ProfileRelationsUnavailableError('unreachable'),
      );

      await expect(
        service.listPedagogicalArchives(STUDENT_ID, FORMATEUR_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(mockArchiveItemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ─── Carnet personnel ───────────────────────────────────────────────────────

  describe('carnet personnel', () => {
    it('exclut le carnet personnel pour le parent financeur', async () => {
      givenRelations([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }], PARENT_ID);

      await service.listPedagogicalArchives(STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    });

    it('n\'exclut pas le carnet personnel pour le titulaire lui-même', async () => {
      givenSelf(STUDENT_ID);

      await service.listPedagogicalArchives(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
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
      mockArchiveItemRepo.create.mockReturnValue(baseArchiveItem);
      mockArchiveItemRepo.save.mockResolvedValue(baseArchiveItem);

      const result = await service.addArchiveLink(STUDENT_ID, addDto, UserRole.FORMATEUR);

      expect(result).toEqual(baseArchiveItem);
      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: STUDENT_ID, itemType: ArchiveItemType.RESUME_DE_COURS }),
      );
    });

    it.each([[UserRole.ELEVE], [UserRole.PARENT_FINANCEUR]])(
      'refuse l\'écriture au rôle %s — une relation ouvre la lecture, jamais l\'écriture',
      async (role) => {
        await expect(service.addArchiveLink(STUDENT_ID, addDto, role)).rejects.toThrow(
          ForbiddenException,
        );
      },
    );

    it('n\'interroge pas profile-service en écriture : le droit vient du rôle', async () => {
      mockArchiveItemRepo.create.mockReturnValue(baseArchiveItem);
      mockArchiveItemRepo.save.mockResolvedValue(baseArchiveItem);

      await service.addArchiveLink(STUDENT_ID, addDto, UserRole.FORMATEUR);

      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });

    it('force isParentVisible à false pour les éléments de type carnet_personnel', async () => {
      mockArchiveItemRepo.create.mockReturnValue({ ...carnetPersonnelItem });
      mockArchiveItemRepo.save.mockResolvedValue({ ...carnetPersonnelItem });

      await service.addArchiveLink(
        STUDENT_ID,
        { ...addDto, itemType: ArchiveItemType.CARNET_PERSONNEL, isParentVisible: true },
        UserRole.FORMATEUR,
      );

      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isParentVisible: false }),
      );
    });

    it('retourne l\'élément existant quand la clé d\'idempotence est déjà utilisée', async () => {
      const existingItem = { ...baseArchiveItem, idempotencyKey: 'unique-key-123' };
      mockArchiveItemRepo.findOne.mockResolvedValue(existingItem);

      const result = await service.addArchiveLink(
        STUDENT_ID,
        { ...addDto, idempotencyKey: 'unique-key-123' },
        UserRole.FORMATEUR,
      );

      expect(result).toEqual(existingItem);
      expect(mockArchiveItemRepo.save).not.toHaveBeenCalled();
    });

    it('lève ConflictException si la clé d\'idempotence appartient à un autre titulaire', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue({
        ...baseArchiveItem,
        studentId: ANOTHER_STUDENT_ID,
        idempotencyKey: 'unique-key-123',
      });

      await expect(
        service.addArchiveLink(
          STUDENT_ID,
          { ...addDto, idempotencyKey: 'unique-key-123' },
          UserRole.FORMATEUR,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('initialise pedagogicalPoints à 0 si non fourni', async () => {
      mockArchiveItemRepo.create.mockReturnValue({ ...baseArchiveItem, pedagogicalPoints: 0 });
      mockArchiveItemRepo.save.mockResolvedValue({ ...baseArchiveItem, pedagogicalPoints: 0 });

      await service.addArchiveLink(
        STUDENT_ID,
        { ...addDto, pedagogicalPoints: undefined },
        UserRole.FORMATEUR,
      );

      expect(mockArchiveItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pedagogicalPoints: 0 }),
      );
    });
  });

  // ─── getArchiveTimeline ─────────────────────────────────────────────────────

  describe('getArchiveTimeline', () => {
    it('retourne les archives groupées par date pour le titulaire', async () => {
      givenSelf(STUDENT_ID);
      mockQueryBuilder.getMany.mockResolvedValue([
        { ...baseArchiveItem, occurredAt: new Date('2026-06-12T14:00:00Z') },
        { ...baseArchiveItem, id: 'item-uuid-3', occurredAt: new Date('2026-06-15T10:00:00Z') },
      ]);

      const result = await service.getArchiveTimeline(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].date).toBe('2026-06-12');
      expect(result.data[1].date).toBe('2026-06-15');
    });

    it('regroupe plusieurs éléments de la même date', async () => {
      givenSelf(STUDENT_ID);
      mockQueryBuilder.getMany.mockResolvedValue([
        { ...baseArchiveItem, occurredAt: new Date('2026-06-12T08:00:00Z') },
        { ...baseArchiveItem, id: 'item-uuid-3', occurredAt: new Date('2026-06-12T14:00:00Z') },
      ]);

      const result = await service.getArchiveTimeline(STUDENT_ID, STUDENT_ID, UserRole.ELEVE);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].items).toHaveLength(2);
    });

    it('REFUSE à l\'élève la timeline de SON formateur', async () => {
      mockProfileRelationsClient.resolveRelations.mockResolvedValue(
        relationSnapshot({
          viewerId: STUDENT_ID,
          targetId: FORMATEUR_ID,
          relations: [{ kind: RelationKind.STUDENT_OF_TEACHER }],
        }),
      );

      await expect(
        service.getArchiveTimeline(FORMATEUR_ID, STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(new NotFoundException(NO_ARCHIVE_MESSAGE));
    });

    it('refuse une timeline sans aucune relation, sans toucher la base', async () => {
      givenNoRelation(PARENT_ID, ANOTHER_STUDENT_ID);

      await expect(
        service.getArchiveTimeline(ANOTHER_STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR),
      ).rejects.toThrow(NotFoundException);
      expect(mockArchiveItemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('exclut le carnet personnel pour le parent financeur', async () => {
      givenRelations([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }], PARENT_ID);

      await service.getArchiveTimeline(STUDENT_ID, PARENT_ID, UserRole.PARENT_FINANCEUR);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('item.itemType != :carnetType', {
        carnetType: ArchiveItemType.CARNET_PERSONNEL,
      });
    });

    it('répond 404 quand la timeline est vide, comme la liste', async () => {
      givenSelf(STUDENT_ID);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await expect(
        service.getArchiveTimeline(STUDENT_ID, STUDENT_ID, UserRole.ELEVE),
      ).rejects.toThrow(new NotFoundException(NO_ARCHIVE_MESSAGE));
    });
  });

  // ─── getArchiveItemForDownload ──────────────────────────────────────────────

  describe('getArchiveItemForDownload', () => {
    it('retourne l\'élément archive avec son URL pour le titulaire', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(baseArchiveItem);
      givenSelf(STUDENT_ID);

      const result = await service.getArchiveItemForDownload(
        baseArchiveItem.id,
        STUDENT_ID,
        UserRole.ELEVE,
      );

      expect(result).toEqual(baseArchiveItem);
    });

    it('autorise le formateur sur un document de SON élève', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(baseArchiveItem);
      givenRelations([{ kind: RelationKind.TEACHER_OF_STUDENT }]);

      await expect(
        service.getArchiveItemForDownload(baseArchiveItem.id, FORMATEUR_ID, UserRole.FORMATEUR),
      ).resolves.toEqual(baseArchiveItem);
    });

    it.each([
      ['élément inexistant', null, () => givenSelf(STUDENT_ID)],
      [
        'aucune relation',
        baseArchiveItem,
        () => givenNoRelation(ANOTHER_STUDENT_ID, STUDENT_ID),
      ],
      [
        'carnet personnel demandé par un parent financeur',
        carnetPersonnelItem,
        () => givenRelations([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }], PARENT_ID),
      ],
      [
        'aucune URL de téléchargement',
        { ...baseArchiveItem, downloadUrl: null },
        () => givenSelf(STUDENT_ID),
      ],
    ])('répond le même 404 pour « %s »', async (_label, item, arrangeRelations) => {
      mockArchiveItemRepo.findOne.mockResolvedValue(item);
      arrangeRelations();

      const role = _label.includes('parent') ? UserRole.PARENT_FINANCEUR : UserRole.ELEVE;
      const requesterId = _label.includes('parent')
        ? PARENT_ID
        : _label === 'aucune relation'
          ? ANOTHER_STUDENT_ID
          : STUDENT_ID;

      await expect(
        service.getArchiveItemForDownload('item-uuid-1', requesterId, role),
      ).rejects.toThrow(new NotFoundException(NO_ARCHIVE_MESSAGE));
    });

    it('ne répond plus 403 sur le carnet personnel : un 403 révélerait son existence', async () => {
      mockArchiveItemRepo.findOne.mockResolvedValue(carnetPersonnelItem);
      givenRelations([{ kind: RelationKind.FINANCE_OWNER_OF_STUDENT }], PARENT_ID);

      const error = await service
        .getArchiveItemForDownload(carnetPersonnelItem.id, PARENT_ID, UserRole.PARENT_FINANCEUR)
        .catch((thrown) => thrown);

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── listArchivesInternal ───────────────────────────────────────────────────

  describe('listArchivesInternal', () => {
    it('retourne toutes les archives sans filtrage ni appel de relation', async () => {
      const allItems = [baseArchiveItem, carnetPersonnelItem];
      mockArchiveItemRepo.find.mockResolvedValue(allItems);

      const result = await service.listArchivesInternal(STUDENT_ID);

      expect(result).toEqual(allItems);
      expect(mockProfileRelationsClient.resolveRelations).not.toHaveBeenCalled();
    });
  });
});
