import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, Logger } from '@nestjs/common';
import { RoleDirectoryService } from '../../../src/profiles/role-directory.service';
import { TeacherDirectoryService } from '../../../src/profiles/teacher-directory.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../../../src/profiles/entities/teacher-pedagogical-profile.entity';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/common/types/actor.type';
import {
  RoleDirectoryPageQueryDto,
  DIRECTORY_PAGE_DEFAULT_LIMIT,
} from '../../../src/profiles/dto/role-directory-page.query.dto';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

const makeQuery = (overrides: Partial<RoleDirectoryPageQueryDto> = {}): RoleDirectoryPageQueryDto => {
  const dto = new RoleDirectoryPageQueryDto();
  dto.role = overrides.role ?? (UserRole.ELEVE as never);
  dto.page = overrides.page;
  dto.limit = overrides.limit;
  return dto;
};

/** Même stub que teacher-directory.service.spec.ts : chaque méthode se renvoie elle-même. */
function makeQueryBuilderStub(rows: unknown[], total: number) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string, args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };

  const builder: Record<string, unknown> = {};
  for (const method of [
    'leftJoin',
    'where',
    'select',
    'addSelect',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
  ]) {
    builder[method] = (...args: unknown[]) => {
      record(method, args);
      return builder;
    };
  }
  builder.clone = () => {
    record('clone', []);
    return builder;
  };
  builder.getCount = async () => total;
  builder.getRawMany = async () => rows;

  return { builder, calls };
}

describe('RoleDirectoryService', () => {
  let service: RoleDirectoryService;
  let administrativeRepo: { createQueryBuilder: jest.Mock };
  let queryBuilder: ReturnType<typeof makeQueryBuilderStub>;
  let identityAccessClient: { listAccountsByRole: jest.Mock };
  let teacherDirectoryService: { listValidatedTeachers: jest.Mock };

  const buildService = async (rows: unknown[], total: number) => {
    queryBuilder = makeQueryBuilderStub(rows, total);
    administrativeRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder.builder),
    };
    identityAccessClient = {
      listAccountsByRole: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
    };
    teacherDirectoryService = {
      listValidatedTeachers: jest.fn().mockResolvedValue({
        data: [],
        page: 1,
        limit: DIRECTORY_PAGE_DEFAULT_LIMIT,
        total: 0,
        totalPages: 0,
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RoleDirectoryService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: administrativeRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: {} },
        { provide: getRepositoryToken(TeacherPedagogicalProfile), useValue: {} },
        { provide: IdentityAccessClient, useValue: identityAccessClient },
        { provide: TeacherDirectoryService, useValue: teacherDirectoryService },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(RoleDirectoryService);
  };

  beforeEach(async () => {
    await buildService([], 0);
  });

  // ---------------------------------------------------------------------------
  // Droits — mêmes rôles administratifs que l'annuaire formateurs
  // ---------------------------------------------------------------------------

  describe('droits d\'accès', () => {
    it.each([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ])('autorise le rôle administratif %s', async (role) => {
      await expect(
        service.listByRole(makeQuery({ role: UserRole.ELEVE as never }), makeActor(role)),
      ).resolves.toEqual(expect.objectContaining({ page: 1 }));
    });

    it.each([UserRole.ELEVE, UserRole.PARENT_FINANCEUR, UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE])(
      'refuse le rôle %s',
      async (role) => {
        await expect(
          service.listByRole(makeQuery({ role: UserRole.ELEVE as never }), makeActor(role)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('n\'interroge ni identity-access-service ni la base quand le rôle est refusé', async () => {
      await service
        .listByRole(makeQuery({ role: UserRole.ELEVE as never }), makeActor(UserRole.ELEVE))
        .catch(() => undefined);

      expect(identityAccessClient.listAccountsByRole).not.toHaveBeenCalled();
      expect(administrativeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // role=formateur : délégation pure, aucune requête locale
  // ---------------------------------------------------------------------------

  describe('role=formateur', () => {
    it('délègue à TeacherDirectoryService.listValidatedTeachers', async () => {
      teacherDirectoryService.listValidatedTeachers.mockResolvedValue({
        data: [
          {
            userId: 'teacher-1',
            firstName: 'Marie',
            lastName: 'Dupont',
            avatarUrl: '/api/v1/profiles/teacher-1/avatar?v=1',
            levels: ['seconde'],
            subjects: ['mathematiques'],
          },
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });

      const result = await service.listByRole(
        makeQuery({ role: UserRole.FORMATEUR as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(teacherDirectoryService.listValidatedTeachers).toHaveBeenCalledTimes(1);
      expect(identityAccessClient.listAccountsByRole).not.toHaveBeenCalled();
      expect(result.data[0]).toEqual({
        userId: 'teacher-1',
        firstName: 'Marie',
        lastName: 'Dupont',
        avatarUrl: '/api/v1/profiles/teacher-1/avatar?v=1',
        level: null,
        levels: ['seconde'],
        subjects: ['mathematiques'],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // role=eleve / parent_financeur / animateur_pedagogique
  // ---------------------------------------------------------------------------

  describe('rôles non-formateur', () => {
    it('interroge identity-access-service pour la population du rôle', async () => {
      await service.listByRole(
        makeQuery({ role: UserRole.ELEVE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(identityAccessClient.listAccountsByRole).toHaveBeenCalledWith(UserRole.ELEVE);
    });

    it('filtre administrative_profiles sur les userId retournés', async () => {
      await service.listByRole(
        makeQuery({ role: UserRole.ELEVE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(queryBuilder.calls.where).toEqual([
        ['administrative.userId IN (:...userIds)', { userIds: ['u1', 'u2'] }],
      ]);
    });

    it('page vide sans requête locale quand identity-access-service ne renvoie personne', async () => {
      identityAccessClient.listAccountsByRole.mockResolvedValue([]);

      const result = await service.listByRole(
        makeQuery({ role: UserRole.PARENT_FINANCEUR as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result).toEqual({ data: [], page: 1, limit: DIRECTORY_PAGE_DEFAULT_LIMIT, total: 0, totalPages: 0 });
      expect(administrativeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('dégrade en page vide si identity-access-service est indisponible, sans lever', async () => {
      identityAccessClient.listAccountsByRole.mockRejectedValue(
        new IdentityAccessUnavailableError('down'),
      );
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await service.listByRole(
        makeQuery({ role: UserRole.ELEVE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data).toEqual([]);
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });

    it('projette un élève avec `level` (singulier), pas `levels`', async () => {
      await buildService(
        [
          {
            userId: 'student-1',
            firstName: 'Camille',
            lastName: 'Durand',
            avatarObjectKey: null,
            avatarUpdatedAt: null,
            administrativeUpdatedAt: new Date('2026-01-01T00:00:00Z'),
            levelRaw: 'Terminale',
            subjects: 'mathematiques,physique',
          },
        ],
        1,
      );

      const result = await service.listByRole(
        makeQuery({ role: UserRole.ELEVE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data[0]).toEqual({
        userId: 'student-1',
        firstName: 'Camille',
        lastName: 'Durand',
        avatarUrl: null,
        level: 'Terminale',
        levels: null,
        subjects: ['mathematiques', 'physique'],
      });
    });

    it('projette un AP avec `levels` (pluriel), pas `level`', async () => {
      await buildService(
        [
          {
            userId: 'ap-1',
            firstName: 'Alex',
            lastName: 'Petit',
            avatarObjectKey: null,
            avatarUpdatedAt: null,
            administrativeUpdatedAt: new Date('2026-01-01T00:00:00Z'),
            levelRaw: 'seconde,premiere',
            subjects: 'mathematiques',
          },
        ],
        1,
      );

      const result = await service.listByRole(
        makeQuery({ role: UserRole.ANIMATEUR_PEDAGOGIQUE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data[0]).toEqual({
        userId: 'ap-1',
        firstName: 'Alex',
        lastName: 'Petit',
        avatarUrl: null,
        level: null,
        levels: ['seconde', 'premiere'],
        subjects: ['mathematiques'],
      });
    });

    it('un parent financeur n\'a aucun bloc pédagogique : level/levels/subjects tous null', async () => {
      await buildService(
        [
          {
            userId: 'parent-1',
            firstName: 'Jean',
            lastName: 'Martin',
            avatarObjectKey: null,
            avatarUpdatedAt: null,
            administrativeUpdatedAt: new Date('2026-01-01T00:00:00Z'),
            levelRaw: null,
            subjects: null,
          },
        ],
        1,
      );

      const result = await service.listByRole(
        makeQuery({ role: UserRole.PARENT_FINANCEUR as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data[0]).toEqual({
        userId: 'parent-1',
        firstName: 'Jean',
        lastName: 'Martin',
        avatarUrl: null,
        level: null,
        levels: null,
        subjects: null,
      });
    });

    it('journalise sans échouer un compte sans profil administratif', async () => {
      await buildService([], 1); // identity renvoie 2 userId, la base n'en compte que 1
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await service.listByRole(
        makeQuery({ role: UserRole.ELEVE as never }),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.total).toBe(1);
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('incohérence de données'));
      loggerSpy.mockRestore();
    });

    it('applique la pagination demandée', async () => {
      const query = makeQuery({ role: UserRole.ELEVE as never });
      query.page = 3;
      query.limit = 5;

      await service.listByRole(query, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE));

      expect(queryBuilder.calls.offset).toEqual([[10]]);
      expect(queryBuilder.calls.limit).toEqual([[5]]);
    });
  });
});
