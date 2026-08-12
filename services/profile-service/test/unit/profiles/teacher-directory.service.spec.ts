import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, Logger } from '@nestjs/common';
import { TeacherDirectoryService } from '../../../src/profiles/teacher-directory.service';
import { TeacherValidation } from '../../../src/profiles/entities/teacher-validation.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/common/types/actor.type';
import {
  ListValidatedTeachersQueryDto,
  VALIDATED_TEACHERS_DEFAULT_LIMIT,
} from '../../../src/profiles/dto/list-validated-teachers.query.dto';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

/**
 * Faux QueryBuilder : chaque méthode de construction se renvoie elle-même, et
 * les appels sont enregistrés pour que les tests puissent vérifier CE QUI A ÉTÉ
 * DEMANDÉ À LA BASE (tri global, fenêtre de pagination) — et pas seulement la
 * forme de la réponse. Un tri appliqué après découpage produirait exactement la
 * même sortie sur une page unique.
 */
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

describe('TeacherDirectoryService', () => {
  let service: TeacherDirectoryService;
  let teacherValidationRepo: { createQueryBuilder: jest.Mock };
  let queryBuilder: ReturnType<typeof makeQueryBuilderStub>;

  const buildService = async (rows: unknown[], total: number) => {
    queryBuilder = makeQueryBuilderStub(rows, total);
    teacherValidationRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder.builder),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherDirectoryService,
        { provide: getRepositoryToken(TeacherValidation), useValue: teacherValidationRepo },
      ],
    }).compile();

    service = moduleRef.get(TeacherDirectoryService);
  };

  beforeEach(async () => {
    await buildService([], 0);
  });

  // ---------------------------------------------------------------------------
  // Droits — périmètre étroit de l'arbitrage du 2026-08-12
  // ---------------------------------------------------------------------------

  describe('droits d\'accès', () => {
    it.each([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ])('autorise le rôle administratif %s', async (role) => {
      await expect(
        service.listValidatedTeachers(new ListValidatedTeachersQueryDto(), makeActor(role)),
      ).resolves.toEqual(
        expect.objectContaining({ data: [], total: 0 }),
      );
    });

    it.each([
      UserRole.ELEVE,
      UserRole.PARENT_FINANCEUR,
      UserRole.FORMATEUR,
      // L'animateur pédagogique n'est PAS un administrateur au sens de
      // l'arbitrage du 2026-08-11 : son droit passe par la relation qu'il
      // entretient avec les formateurs qu'il anime, pas par un annuaire global.
      UserRole.ANIMATEUR_PEDAGOGIQUE,
    ])('refuse le rôle %s', async (role) => {
      await expect(
        service.listValidatedTeachers(new ListValidatedTeachersQueryDto(), makeActor(role)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse avec un message en français, destiné à l\'utilisateur', async () => {
      await expect(
        service.listValidatedTeachers(
          new ListValidatedTeachersQueryDto(),
          makeActor(UserRole.ELEVE),
        ),
      ).rejects.toThrow(/réservé aux rôles administratifs/);
    });

    it('n\'interroge pas la base quand le rôle est refusé', async () => {
      await service
        .listValidatedTeachers(new ListValidatedTeachersQueryDto(), makeActor(UserRole.ELEVE))
        .catch(() => undefined);

      expect(teacherValidationRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Contenu — socle de visibilité, rien de plus
  // ---------------------------------------------------------------------------

  describe('contenu servi', () => {
    it('ne renvoie que le socle : userId, firstName, lastName, levels, subjects', async () => {
      await buildService(
        [
          {
            userId: 'teacher-1',
            firstName: 'Marie',
            lastName: 'Dupont',
            levels: 'seconde,premiere',
            subjects: 'mathematiques',
          },
        ],
        1,
      );

      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(Object.keys(result.data[0]).sort()).toEqual([
        'firstName',
        'lastName',
        'levels',
        'subjects',
        'userId',
      ]);
    });

    it('convertit les colonnes simple-array en tableaux', async () => {
      await buildService(
        [
          {
            userId: 'teacher-1',
            firstName: 'Marie',
            lastName: 'Dupont',
            levels: 'seconde,premiere',
            subjects: 'mathematiques',
          },
        ],
        1,
      );

      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data[0].levels).toEqual(['seconde', 'premiere']);
      expect(result.data[0].subjects).toEqual(['mathematiques']);
    });

    it('distingue « non renseigné » (null) de « renseigné vide » ([])', async () => {
      await buildService(
        [
          {
            userId: 'teacher-1',
            firstName: 'Marie',
            lastName: 'Dupont',
            levels: null,
            subjects: '',
          },
        ],
        1,
      );

      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data[0].levels).toBeNull();
      expect(result.data[0].subjects).toEqual([]);
    });

    it('conserve et journalise un formateur validé sans profil administratif', async () => {
      await buildService(
        [{ userId: 'teacher-orphan', firstName: null, lastName: null, levels: null, subjects: null }],
        1,
      );
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        userId: 'teacher-orphan',
        firstName: null,
        lastName: null,
        levels: null,
        subjects: null,
      });
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('teacher-orphan'));
      loggerSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Pagination — bornes, plafond, page vide
  // ---------------------------------------------------------------------------

  describe('pagination', () => {
    it('applique les valeurs par défaut quand rien n\'est demandé', async () => {
      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.page).toBe(1);
      expect(result.limit).toBe(VALIDATED_TEACHERS_DEFAULT_LIMIT);
      expect(queryBuilder.calls.offset).toEqual([[0]]);
      expect(queryBuilder.calls.limit).toEqual([[VALIDATED_TEACHERS_DEFAULT_LIMIT]]);
    });

    it('traduit page et limit en fenêtre SQL', async () => {
      const query = new ListValidatedTeachersQueryDto();
      query.page = 3;
      query.limit = 5;

      await service.listValidatedTeachers(query, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE));

      expect(queryBuilder.calls.offset).toEqual([[10]]);
      expect(queryBuilder.calls.limit).toEqual([[5]]);
    });

    it('première page : offset 0, jamais négatif', async () => {
      const query = new ListValidatedTeachersQueryDto();
      query.page = 1;
      query.limit = 1;

      await service.listValidatedTeachers(query, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE));

      expect(queryBuilder.calls.offset).toEqual([[0]]);
    });

    it('compte le total sur l\'ensemble, pas sur la page', async () => {
      await buildService(
        [{ userId: 'teacher-1', firstName: 'A', lastName: 'B', levels: null, subjects: null }],
        42,
      );
      const query = new ListValidatedTeachersQueryDto();
      query.limit = 1;

      const result = await service.listValidatedTeachers(
        query,
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.total).toBe(42);
      expect(result.totalPages).toBe(42);
      expect(result.data).toHaveLength(1);
    });

    it('arrondit totalPages à la page supérieure', async () => {
      await buildService([], 21);

      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.totalPages).toBe(2);
    });

    it('renvoie une page vide sans erreur au-delà de la dernière page', async () => {
      await buildService([], 3);
      const query = new ListValidatedTeachersQueryDto();
      query.page = 99;

      const result = await service.listValidatedTeachers(
        query,
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result).toEqual({
        data: [],
        page: 99,
        limit: VALIDATED_TEACHERS_DEFAULT_LIMIT,
        total: 3,
        totalPages: 1,
      });
    });

    it('annuaire vide : data vide, total et totalPages à 0', async () => {
      const result = await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Requête — ne lister que les validés, trier globalement
  // ---------------------------------------------------------------------------

  describe('requête envoyée à la base', () => {
    it('ne retient que le statut validated', async () => {
      await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(queryBuilder.calls.where).toEqual([
        ['validation.status = :status', { status: 'validated' }],
      ]);
    });

    it('trie par nom, puis prénom, puis identifiant pour un ordre stable', async () => {
      await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(queryBuilder.calls.orderBy?.[0][0]).toBe('administrative.lastName');
      expect(queryBuilder.calls.addOrderBy?.[0][0]).toBe('administrative.firstName');
      expect(queryBuilder.calls.addOrderBy?.[1][0]).toBe('validation.teacherId');
    });

    it('compte sur une copie de la requête, avant fenêtrage', async () => {
      await service.listValidatedTeachers(
        new ListValidatedTeachersQueryDto(),
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE),
      );

      expect(queryBuilder.calls.clone).toHaveLength(1);
    });
  });
});
