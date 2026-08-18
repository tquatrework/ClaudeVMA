import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProfilesService, Actor } from '../../../src/profiles/profiles.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../../../src/profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../../../src/profiles/entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from '../../../src/profiles/entities/internal-profile-note.entity';
import { TeacherValidation } from '../../../src/profiles/entities/teacher-validation.entity';
import { RelationsService } from '../../../src/relations/relations.service';
import { RelationKind } from '../../../src/relations/relation-kind';
import { EventsService } from '../../../src/events/events.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { FieldVisibilityService } from '../../../src/profiles/field-visibility.service';
import {
  FIELD_VISIBILITY_CATALOG,
  FieldAudience,
} from '../../../src/profiles/field-visibility.catalog';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

/** Réglages effectifs quand l'utilisateur n'a enregistré aucune dérogation. */
const audiencesFromCatalog = (
  overrides: Record<string, FieldAudience> = {},
): Map<string, FieldAudience> =>
  new Map(
    FIELD_VISIBILITY_CATALOG.map((definition) => [
      definition.fieldName,
      overrides[definition.fieldName] ?? definition.defaultAudience,
    ]),
  );

describe('ProfilesService', () => {
  let service: ProfilesService;
  let adminRepo: any;
  let studentPedaRepo: any;
  let teacherPedaRepo: any;
  let noteRepo: any;
  let teacherValidationRepo: any;
  let relationsService: any;
  let eventsService: any;
  let identityAccessClient: any;
  let fieldVisibilityService: any;

  beforeEach(async () => {
    /**
     * Le rôle du compte est désormais la source autoritative pour savoir si une
     * écriture pédagogique vise le profil élève ou formateur : le stub doit
     * donc répondre par userId, et non un rôle unique pour tout le monde.
     * Tout userId contenant « teacher » est un formateur, les autres sont des
     * élèves — convention de nommage déjà suivie par les fixtures du fichier.
     */
    identityAccessClient = {
      findAccountByUserId: jest.fn().mockImplementation(async (userId: string) =>
        userId.includes('teacher')
          ? { userId, loginIdentifier: 'paul.durand', role: 'formateur' }
          : { userId, loginIdentifier: 'alice.martin', role: 'eleve' },
      ),
      findAccountByLoginIdentifier: jest.fn(),
    };

    adminRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    studentPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    teacherPedaRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, updatedAt: new Date() })),
    };

    noteRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'note-uuid', ...entity, createdAt: new Date() })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    teacherValidationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'validation-uuid', ...entity, updatedAt: new Date() })),
    };

    relationsService = {
      isTeacherLinkedToStudent: jest.fn().mockResolvedValue(false),
      isFinanceOwnerLinkedToStudent: jest.fn().mockResolvedValue(false),
      // Aucune relation par défaut : c'est l'état d'un lecteur quelconque, et
      // désormais le socle du droit d'accès aux statistiques (arbitrage 2026-08-11).
      resolveRelations: jest.fn().mockResolvedValue([]),
    };
    eventsService = { publish: jest.fn() };

    /**
     * Par défaut, aucune dérogation enregistrée : chaque champ retombe sur la
     * visibilité par défaut du catalogue. Les tests de filtrage remplacent ce
     * comportement par une map explicite.
     */
    fieldVisibilityService = {
      resolveAudiences: jest
        .fn()
        .mockImplementation(async () => audiencesFromCatalog()),
      resolveAudience: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
        { provide: getRepositoryToken(StudentPedagogicalProfile), useValue: studentPedaRepo },
        { provide: getRepositoryToken(TeacherPedagogicalProfile), useValue: teacherPedaRepo },
        { provide: getRepositoryToken(InternalProfileNote), useValue: noteRepo },
        { provide: getRepositoryToken(TeacherValidation), useValue: teacherValidationRepo },
        { provide: RelationsService, useValue: relationsService },
        { provide: EventsService, useValue: eventsService },
        { provide: IdentityAccessClient, useValue: identityAccessClient },
        { provide: FieldVisibilityService, useValue: fieldVisibilityService },
        // ProfilesService lit AVATAR_PUBLIC_PATH_PREFIX au démarrage pour
        // construire `avatarUrl`. Le stub renvoie undefined : le service
        // retombe alors sur le préfixe par défaut, celui de l'api-gateway.
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  // ---------------------------------------------------------------------------
  // getProfile
  // ---------------------------------------------------------------------------
  describe('getProfile', () => {
    const mockAdminProfile = { userId: 'student-uuid', firstName: 'Alice', lastName: 'Martin' };

    it('returns profile data for RP regardless of target', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('userId', 'student-uuid');
    });

    it('returns own profile for élève', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    it('includes loginIdentifier from identity-access-service', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockResolvedValue({
        userId: 'student-uuid',
        loginIdentifier: 'alice.martin',
        role: 'eleve',
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('loginIdentifier', 'alice.martin');
    });

    // The account-existence signal and the loginIdentifier come from a single
    // identity-access-service call: no extra HTTP round-trip may be added.
    it('calls identity-access-service exactly once', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await service.getProfile('student-uuid', actor);

      expect(identityAccessClient.findAccountByUserId).toHaveBeenCalledTimes(1);
      expect(identityAccessClient.findAccountByUserId).toHaveBeenCalledWith('student-uuid');
    });

    it('throws 404 when identity-access-service does not know the userId', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('not found'),
      );
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(NotFoundException);
    });

    // Regression guard: an outage of identity-access-service must never be
    // turned into a 404, otherwise every profile of the platform would look
    // deleted at once. Only IdentityAccessNotFoundError means "unknown user".
    it('returns loginIdentifier null on network error (graceful degradation)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('ECONNREFUSED'),
      );
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);
      expect(result).toHaveProperty('loginIdentifier', null);
    });

    // Regression test: a real infrastructure/config failure between
    // profile-service and identity-access-service (e.g. mismatched
    // INTERNAL_SECRET causing a 401/403, wrong URL, DNS failure, timeout —
    // all surfaced as IdentityAccessUnavailableError) must remain visible in
    // logs even though the caller still degrades gracefully to
    // loginIdentifier: null. It must not look like a routine 404 "account
    // not found" (IdentityAccessNotFoundError), which is not logged as an
    // error.
    it('logs an error when loginIdentifier resolution fails due to a config/infra error (distinct from a plain 404)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('identity-access-service returned HTTP 401'),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getProfile('student-uuid', actor);

      expect(result).toHaveProperty('loginIdentifier', null);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('student-uuid'));
    });

    it('does not log an error when identity-access-service answers a plain 404 (expected case)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('not found'),
      );

      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(NotFoundException);
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('throws 403 when élève tries to view another profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(service.getProfile('other-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows formateur to view linked student profile (PROF-FB-003)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
      expect(relationsService.isTeacherLinkedToStudent).toHaveBeenCalledWith('teacher-uuid', 'student-uuid');
    });

    it('throws 403 when formateur views non-linked student (PROF-FB-003)', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      relationsService.isTeacherLinkedToStudent.mockResolvedValue(false);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('allows parent_financeur to view linked student profile (PROF-RA-002)', async () => {
      adminRepo.findOne.mockResolvedValue(mockAdminProfile);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(true);

      const result = await service.getProfile('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
      expect(relationsService.isFinanceOwnerLinkedToStudent).toHaveBeenCalledWith('parent-uuid', 'student-uuid');
    });

    it('throws 403 when parent_financeur views non-linked student (PROF-RA-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');
      relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(false);

      await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    // -------------------------------------------------------------------------
    // Read-only guarantee — docs/architecture.md, arbitrages du 2026-08-07 :
    // "Aucune lecture ne doit creer un profil a la volee — une requete de
    //  consultation n'ecrit jamais en base."
    // The three lazy-init paths that used to live here (administrative profile,
    // student pedagogical profile, teacher pedagogical profile) have been
    // removed; these tests are the regression guard against their return.
    // -------------------------------------------------------------------------
    describe('read-only guarantee (no lazy creation)', () => {
      it('throws 500 and logs an anomaly when the account exists but has no administrative profile', async () => {
        const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        // adminRepo.findOne returns null by default, and the identity-access
        // client resolves an existing account: this is a data inconsistency.

        await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('student-uuid'));
        expect(errorSpy.mock.calls[0][0]).toEqual(expect.stringContaining('ANOMALIE DE DONNEES'));
      });

      it('throws 500 (not 404) when the administrative profile is missing and identity-access-service is unavailable', async () => {
        jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
        identityAccessClient.findAccountByUserId.mockRejectedValue(
          new IdentityAccessUnavailableError('ECONNREFUSED'),
        );
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await expect(service.getProfile('student-uuid', actor)).rejects.toThrow(
          InternalServerErrorException,
        );
      });

      it('never writes anything when no profile exists at all', async () => {
        jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await expect(service.getProfile('new-user-uuid', actor)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(adminRepo.create).not.toHaveBeenCalled();
        expect(adminRepo.save).not.toHaveBeenCalled();
        expect(studentPedaRepo.create).not.toHaveBeenCalled();
        expect(studentPedaRepo.save).not.toHaveBeenCalled();
        expect(teacherPedaRepo.create).not.toHaveBeenCalled();
        expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      });

      it('does not create a student pedagogical profile for an élève viewing their own account', async () => {
        const eleveId = '87482274-1ef2-412a-827b-75fc48c28370';
        const actor = makeActor(UserRole.ELEVE, eleveId);
        adminRepo.findOne.mockResolvedValue({ userId: eleveId, firstName: 'Alice' });

        const result = await service.getProfile(eleveId, actor);

        expect(studentPedaRepo.create).not.toHaveBeenCalled();
        expect(studentPedaRepo.save).not.toHaveBeenCalled();
        expect(result).toHaveProperty('pedagogical', null);
      });

      it('does not create a teacher pedagogical profile for a formateur viewing their own account', async () => {
        const teacherId = 'bba9e321-4f12-4c8a-b6d3-000000000001';
        const actor = makeActor(UserRole.FORMATEUR, teacherId);
        adminRepo.findOne.mockResolvedValue({ userId: teacherId, firstName: 'Jean' });

        const result = await service.getProfile(teacherId, actor);

        expect(teacherPedaRepo.create).not.toHaveBeenCalled();
        expect(teacherPedaRepo.save).not.toHaveBeenCalled();
        expect(result).toHaveProperty('pedagogical', null);
      });

      it('does not write anything on a fully populated profile read', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        adminRepo.findOne.mockResolvedValue({ userId: 'student-uuid', firstName: 'Alice' });
        studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid', level: 'Terminale' });

        await service.getProfile('student-uuid', actor);

        expect(adminRepo.save).not.toHaveBeenCalled();
        expect(studentPedaRepo.save).not.toHaveBeenCalled();
        expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      });
    });

    // -------------------------------------------------------------------------
    // Missing pedagogical profile is a NORMAL state (200 + pedagogical: null),
    // not an anomaly: the pedagogical profile is optional and only created when
    // the user first saves it (PUT upsert).
    // -------------------------------------------------------------------------
    describe('optional pedagogical profile', () => {
      it('returns 200 with pedagogical: null when the élève has no pedagogical profile yet', async () => {
        const eleveId = '87482274-1ef2-412a-827b-75fc48c28370';
        const actor = makeActor(UserRole.ELEVE, eleveId);
        adminRepo.findOne.mockResolvedValue({ userId: eleveId, firstName: 'Alice' });

        const result = await service.getProfile(eleveId, actor);

        expect(result).toEqual({
          userId: eleveId,
          loginIdentifier: 'alice.martin',
          // Le bloc administratif est PROJETÉ (administrative-profile.view.ts) :
          // tous les champs exposés y figurent, à `null` quand ils ne sont pas
          // renseignés — « clé présente à null » veut dire « non renseigné », par
          // opposition à « clé absente » qui veut dire « masqué ». Les champs de
          // stockage de la photo (avatarObjectKey, avatarContentType) n'en font
          // jamais partie ; seul `avatarUrl` est exposé.
          administrative: {
            userId: eleveId,
            firstName: 'Alice',
            lastName: null,
            birthDate: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            postalCode: null,
            city: null,
            country: null,
            avatarUrl: null,
            passions: null,
            createdAt: undefined,
            updatedAt: undefined,
          },
          pedagogical: null,
          // null tant qu'aucun profil pédagogique n'existe — le front n'a donc
          // aucun jeu de champs à afficher, et n'a pas à le deviner.
          pedagogicalType: null,
          // Le titulaire lit sa propre fiche : aucun filtrage, et le verdict est
          // dit explicitement plutôt que laissé à déduire d'une liste vide.
          visibility: { isFiltered: false, hiddenFields: [] },
        });
      });

      it('returns 200 with pedagogical: null when RP consults a user without a pedagogical profile', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        adminRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });

        const result = await service.getProfile('student-uuid', actor);

        expect(result).toHaveProperty('pedagogical', null);
      });

      it('returns the student pedagogical profile when it exists', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        const existingPeda = { userId: 'student-uuid', level: 'Terminale' };
        adminRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });
        studentPedaRepo.findOne.mockResolvedValue(existingPeda);

        const result = await service.getProfile('student-uuid', actor);

        expect(result).toHaveProperty('pedagogical', existingPeda);
      });

      it('returns the teacher pedagogical profile when it exists', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        const existingTeacherPeda = { userId: 'teacher-uuid', levels: ['Lycée'] };
        adminRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid' });
        teacherPedaRepo.findOne.mockResolvedValue(existingTeacherPeda);

        const result = await service.getProfile('teacher-uuid', actor);

        expect(result).toHaveProperty('pedagogical', existingTeacherPeda);
      });
    });

    // -------------------------------------------------------------------------
    // Visibilité champ par champ appliquée en lecture (arbitrage 2026-08-09).
    // Le scénario de référence : l'élève masque `difficulties` et `phone` en
    // les réglant `self`. Son parent financeur doit les voir quand même, son
    // formateur non, et lui-même toujours.
    // -------------------------------------------------------------------------
    describe('field visibility filtering', () => {
      const STUDENT_ID = 'student-uuid';
      const administrative = {
        userId: STUDENT_ID,
        firstName: 'Alice',
        lastName: 'Martin',
        phone: '0600000000',
        city: 'Lyon',
      };
      const pedagogical = {
        userId: STUDENT_ID,
        level: '3ème',
        subjects: ['maths'],
        difficulties: 'Trigonométrie',
        generalAssessment: 'Élève sérieuse',
        filledBy: 'rp-uuid',
      };

      beforeEach(() => {
        adminRepo.findOne.mockResolvedValue(administrative);
        studentPedaRepo.findOne.mockResolvedValue(pedagogical);
      });

      it('montre au TITULAIRE sa fiche entière, prescription comprise', async () => {
        const actor = makeActor(UserRole.ELEVE, STUDENT_ID);

        const result = await service.getProfile(STUDENT_ID, actor);

        // `toMatchObject` et non `toEqual` : le bloc administratif est projeté,
        // donc il porte en plus les champs non renseignés à `null` (dont
        // `avatarUrl`). Ce qui est vérifié ici, c'est qu'AUCUN champ du
        // titulaire n'est retiré.
        expect(result.administrative).toMatchObject(administrative);
        expect(result.administrative).toHaveProperty('avatarUrl', null);
        expect(result.pedagogical).toEqual(pedagogical);
        expect(result.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
        // Aucun réglage n'est même consulté : on ne se filtre pas soi-même.
        expect(fieldVisibilityService.resolveAudiences).not.toHaveBeenCalled();
      });

      it('montre au PARENT FINANCEUR un champ que son élève a réglé `self`', async () => {
        relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(true);
        fieldVisibilityService.resolveAudiences.mockResolvedValue(
          audiencesFromCatalog({ difficulties: 'self', phone: 'self' }),
        );
        const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        // « Le parent financeur voit tout, sauf le carnet personnel » : un élève
        // ne peut pas lui masquer une donnée de profil.
        expect(result.pedagogical).toMatchObject({ difficulties: 'Trigonométrie' });
        expect(result.administrative).toMatchObject({ phone: '0600000000' });
        expect(result.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
      });

      it('cache au FORMATEUR lié le même champ réglé `self`', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        fieldVisibilityService.resolveAudiences.mockResolvedValue(
          audiencesFromCatalog({ difficulties: 'self', phone: 'self' }),
        );
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        expect('difficulties' in (result.pedagogical as object)).toBe(false);
        expect('phone' in (result.administrative as object)).toBe(false);
        expect(result.visibility.isFiltered).toBe(true);
        expect(result.visibility.hiddenFields).toEqual(
          expect.arrayContaining(['difficulties', 'phone']),
        );
      });

      it('montre au formateur lié un champ que l\'élève a explicitement partagé', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        fieldVisibilityService.resolveAudiences.mockResolvedValue(
          audiencesFromCatalog({ difficulties: 'linked' }),
        );
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        expect(result.pedagogical).toMatchObject({ difficulties: 'Trigonométrie' });
        expect(result.visibility.hiddenFields).not.toContain('difficulties');
      });

      it('ne masque JAMAIS pedagogicalType, dont le front a besoin pour afficher', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        expect(result.pedagogicalType).toBe('student');
        expect(result.userId).toBe(STUDENT_ID);
      });

      it.each([
        ['responsable_pedagogique', UserRole.RESPONSABLE_PEDAGOGIQUE],
        ['animateur_pedagogique', UserRole.ANIMATEUR_PEDAGOGIQUE],
        ['technicien_informatique', UserRole.TECHNICIEN_INFORMATIQUE],
        ['administrateur_financier', UserRole.ADMINISTRATEUR_FINANCIER],
      ])('exempte le rôle %s du filtrage', async (_label, role) => {
        fieldVisibilityService.resolveAudiences.mockResolvedValue(
          audiencesFromCatalog({ difficulties: 'self' }),
        );
        const actor = makeActor(role, 'admin-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        expect(result.pedagogical).toEqual(pedagogical);
        expect(result.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
      });

      it('masque la prescription au formateur lié, métadonnées comprises, quand l’élève a explicitement réglé TOUTE la prescription `self`', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        fieldVisibilityService.resolveAudiences.mockResolvedValue(
          audiencesFromCatalog({
            generalAssessment: 'self',
            recommendedPace: 'self',
            recommendedTeacherProfile: 'self',
            recommendedPath: 'self',
            recommendedActivities: 'self',
          }),
        );
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        const result = await service.getProfile(STUDENT_ID, actor);

        expect('generalAssessment' in (result.pedagogical as object)).toBe(false);
        expect('filledBy' in (result.pedagogical as object)).toBe(false);
        expect(result.visibility.hiddenFields).toEqual(
          expect.arrayContaining(['generalAssessment', 'filledBy']),
        );
      });

      it('n\'écrit rien en base en filtrant — une lecture reste une lecture', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        await service.getProfile(STUDENT_ID, actor);

        expect(adminRepo.save).not.toHaveBeenCalled();
        expect(studentPedaRepo.save).not.toHaveBeenCalled();
        expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      });

      it('ne lit les réglages qu\'une seule fois, pas un appel par champ', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(true);
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        await service.getProfile(STUDENT_ID, actor);

        expect(fieldVisibilityService.resolveAudiences).toHaveBeenCalledTimes(1);
        expect(fieldVisibilityService.resolveAudience).not.toHaveBeenCalled();
      });

      it('refuse toujours en 403 un formateur NON lié, avant tout filtrage', async () => {
        relationsService.isTeacherLinkedToStudent.mockResolvedValue(false);
        const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

        await expect(service.getProfile(STUDENT_ID, actor)).rejects.toThrow(ForbiddenException);
        expect(fieldVisibilityService.resolveAudiences).not.toHaveBeenCalled();
      });

      it('refuse toujours en 403 un parent NON lié — l\'exemption suppose le rattachement', async () => {
        relationsService.isFinanceOwnerLinkedToStudent.mockResolvedValue(false);
        const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');

        await expect(service.getProfile(STUDENT_ID, actor)).rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // getPedagogicalStatistics — même filtrage que le bloc pédagogique
  // ---------------------------------------------------------------------------
  describe('getPedagogicalStatistics', () => {
    const STUDENT_ID = 'student-uuid';

    beforeEach(() => {
      studentPedaRepo.findOne.mockResolvedValue({
        userId: STUDENT_ID,
        level: '3ème',
        subjects: ['maths'],
      });
    });

    it('rend les statistiques entières au titulaire', async () => {
      const actor = makeActor(UserRole.ELEVE, STUDENT_ID);

      const result = await service.getPedagogicalStatistics(STUDENT_ID, actor);

      expect(result.statistics).toEqual({ level: '3ème', subjects: ['maths'] });
      expect(result.visibility).toEqual({ isFiltered: false, hiddenFields: [] });
    });

    it('applique le même filtrage qu\'au bloc pédagogique — pas de contournement', async () => {
      relationsService.resolveRelations.mockResolvedValue([
        { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: false },
      ]);
      fieldVisibilityService.resolveAudiences.mockResolvedValue(
        audiencesFromCatalog({ level: 'self' }),
      );
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');

      const result = await service.getPedagogicalStatistics(STUDENT_ID, actor);

      // Sans ce filtrage, cette route rendrait un `level` réglé `self` que
      // GET /profiles/:userId refuse — le réglage serait contournable.
      expect('level' in result.statistics).toBe(false);
      expect(result.visibility.hiddenFields).toContain('level');
    });

    it('n\'applique aucun filtrage au parent financeur rattaché', async () => {
      relationsService.resolveRelations.mockResolvedValue([
        { kind: RelationKind.FINANCE_OWNER_OF_STUDENT },
      ]);
      fieldVisibilityService.resolveAudiences.mockResolvedValue(
        audiencesFromCatalog({ level: 'self' }),
      );
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');

      const result = await service.getPedagogicalStatistics(STUDENT_ID, actor);

      expect(result.statistics).toMatchObject({ level: '3ème' });
      expect(result.visibility.isFiltered).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Droit d'accès piloté par la RELATION (arbitrage du 2026-08-11)
    // -------------------------------------------------------------------------

    it('ouvre les statistiques du formateur à son élève — nouveau droit, symétrique', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue({
        userId: 'teacher-uuid',
        levels: ['Terminale'],
        subjects: ['maths'],
        isAnimateurPedagogique: false,
      });
      relationsService.resolveRelations.mockResolvedValue([
        { kind: RelationKind.STUDENT_OF_TEACHER },
      ]);
      const actor = makeActor(UserRole.ELEVE, STUDENT_ID);

      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);

      expect(result.profileType).toBe('teacher');
      expect(result.visibility.isFiltered).toBe(true);
    });

    it("ouvre les statistiques du formateur au parent, par l'élève commun", async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid', subjects: ['maths'] });
      relationsService.resolveRelations.mockResolvedValue([
        { kind: RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER, throughUserIds: [STUDENT_ID] },
      ]);
      const actor = makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid');

      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);

      // Lié, donc filtré : le lien indirect ouvre la lecture, il ne donne pas
      // au parent le droit de voir ce que le formateur a masqué.
      expect(result.visibility.isFiltered).toBe(true);
    });

    it("ouvre les statistiques du formateur à l'AP qui l'anime, sans filtrage", async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid', levels: ['Terminale'] });
      relationsService.resolveRelations.mockResolvedValue([
        { kind: RelationKind.ANIMATOR_OF_TEACHER },
      ]);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid');

      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);

      expect(result.visibility.isFiltered).toBe(false);
    });

    it('ouvre tout aux administrateurs, sans relation — RP, AF et TI', async () => {
      for (const role of [
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.ADMINISTRATEUR_FINANCIER,
        UserRole.TECHNICIEN_INFORMATIQUE,
      ]) {
        const result = await service.getPedagogicalStatistics(STUDENT_ID, makeActor(role, 'admin-uuid'));
        expect(result.visibility.isFiltered).toBe(false);
      }
    });

    it.each([
      ['formateur non rattaché', UserRole.FORMATEUR],
      ['parent non rattaché', UserRole.PARENT_FINANCEUR],
      ['élève tiers', UserRole.ELEVE],
      ['AP sans lien d\'animation', UserRole.ANIMATEUR_PEDAGOGIQUE],
    ])('refuse %s en 404, jamais en 403 — on ne révèle pas ce qu\'on masque', async (_label, role) => {
      relationsService.resolveRelations.mockResolvedValue([]);
      const actor = makeActor(role, 'stranger-uuid');

      await expect(service.getPedagogicalStatistics(STUDENT_ID, actor)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getPedagogicalStatistics(STUDENT_ID, actor)).rejects.not.toThrow(
        ForbiddenException,
      );
    });

    it('refuse un lecteur sans relation AVANT de lire la base — aucune fuite par le temps de réponse ni par le message', async () => {
      relationsService.resolveRelations.mockResolvedValue([]);
      studentPedaRepo.findOne.mockClear();
      teacherPedaRepo.findOne.mockClear();

      await expect(
        service.getPedagogicalStatistics(STUDENT_ID, makeActor(UserRole.FORMATEUR, 'stranger-uuid')),
      ).rejects.toThrow(NotFoundException);

      expect(studentPedaRepo.findOne).not.toHaveBeenCalled();
      expect(teacherPedaRepo.findOne).not.toHaveBeenCalled();
    });

    it('donne le MÊME message pour « pas de statistiques » et « pas le droit »', async () => {
      const denied = await service
        .getPedagogicalStatistics(STUDENT_ID, makeActor(UserRole.FORMATEUR, 'stranger-uuid'))
        .catch((error) => error.message);

      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue(null);
      const missing = await service
        .getPedagogicalStatistics(STUDENT_ID, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE))
        .catch((error) => error.message);

      expect(denied).toBe(missing);
    });

    it('conserve isAnimateurPedagogique dans les statistiques formateur', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue({
        userId: 'teacher-uuid',
        levels: ['Terminale'],
        subjects: ['maths'],
        isAnimateurPedagogique: true,
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);

      expect(result.profileType).toBe('teacher');
      expect(result.statistics).toMatchObject({ isAnimateurPedagogique: true });
    });

    it('renvoie 404 quand aucun profil pédagogique n\'existe', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      teacherPedaRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await expect(
        service.getPedagogicalStatistics(STUDENT_ID, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateAdministrativeProfile
  // ---------------------------------------------------------------------------
  describe('updateAdministrativeProfile', () => {
    it('creates admin profile when it does not exist', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { firstName: 'Alice', lastName: 'Martin' };
      const result = await service.updateAdministrativeProfile('user-uuid', dto, actor);
      expect(adminRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith('ProfileUpdated', expect.objectContaining({ userId: 'user-uuid' }));
    });

    it('updates existing admin profile', async () => {
      const existing = { userId: 'user-uuid', firstName: 'Old', lastName: 'Name' };
      adminRepo.findOne.mockResolvedValue(existing);
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updateAdministrativeProfile('user-uuid', { firstName: 'New' }, actor);
      expect(adminRepo.save).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'New' }));
    });

    it('allows RP to update any user profile', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.updateAdministrativeProfile('other-user-uuid', { firstName: 'Test' }, actor),
      ).resolves.toBeDefined();
    });

    it('throws 403 when a regular user tries to update another user profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await expect(
        service.updateAdministrativeProfile('other-uuid', { firstName: 'Hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts the passions field', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { passions: ['Musique', 'Randonnée'] };
      await service.updateAdministrativeProfile('user-uuid', dto, actor);
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ passions: ['Musique', 'Randonnée'] }),
      );
    });

    // `department` a été retiré le 2026-08-11. Son refus en entrée est porté
    // par le DTO (`forbidNonWhitelisted`) et couvert en e2e ; ici on verrouille
    // la SORTIE, seule chose que le service maîtrise : la vue exposée ne doit
    // plus comporter la clé, même si une ligne héritée la portait encore.
    it('n’expose plus department dans la réponse', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const view = await service.updateAdministrativeProfile(
        'user-uuid',
        { firstName: 'Alice' },
        actor,
      );
      expect(view).not.toHaveProperty('department');
    });
  });

  // ---------------------------------------------------------------------------
  // updatePedagogicalProfile
  // ---------------------------------------------------------------------------
  describe('updatePedagogicalProfile', () => {
    it('creates student pedagogical profile when payload has level', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { level: 'Terminale', subjects: ['Mathématiques'] };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith(
        'ProfileUpdated',
        expect.objectContaining({ userId: 'user-uuid', section: 'pedagogical-student' }),
      );
    });

    it('updates existing student pedagogical profile', async () => {
      const existingProfile = { userId: 'user-uuid', level: '3ème', subjects: [] };
      studentPedaRepo.findOne.mockResolvedValue(existingProfile);
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { level: 'Seconde', goals: 'Préparer le bac' };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'Seconde', goals: 'Préparer le bac' }),
      );
    });

    it('creates teacher pedagogical profile when payload has levels', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { levels: ['Lycée'], subjects: ['Mathématiques'] };
      await service.updatePedagogicalProfile('teacher-uuid', dto, actor);
      expect(teacherPedaRepo.save).toHaveBeenCalled();
      expect(eventsService.publish).toHaveBeenCalledWith(
        'ProfileUpdated',
        expect.objectContaining({ userId: 'teacher-uuid', section: 'pedagogical-teacher' }),
      );
    });

    it('updates existing teacher pedagogical profile', async () => {
      const existingProfile = { userId: 'teacher-uuid', levels: ['Collège'], subjects: [] };
      teacherPedaRepo.findOne.mockResolvedValue(existingProfile);
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { subjects: ['Physique-Chimie'], experience: '3 ans' };
      await service.updatePedagogicalProfile('teacher-uuid', dto, actor);
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ subjects: ['Physique-Chimie'], experience: '3 ans' }),
      );
    });

    it('allows RP to update pedagogical profile of any user', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const dto = { level: '3ème' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).resolves.toBeDefined();
    });

    it('allows TI to update pedagogical profile of any user', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const dto = { level: 'Seconde' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).resolves.toBeDefined();
    });

    it('throws 403 when élève tries to update another user pedagogical profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const dto = { level: 'Terminale' };
      await expect(
        service.updatePedagogicalProfile('other-uuid', dto, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to update student pedagogical profile', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const dto = { level: 'Terminale' };
      await expect(
        service.updatePedagogicalProfile('student-uuid', dto, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts specificNeeds field on student profile', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      const dto = { specificNeeds: 'Dyslexie légère' };
      await service.updatePedagogicalProfile('user-uuid', dto, actor);
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ specificNeeds: 'Dyslexie légère' }),
      );
    });

    /**
     * `difficulties` (ce sur quoi l'élève bute) et `specificNeeds`
     * (aménagement reconnu : DYS, PAP, PPS) sont deux champs DISTINCTS. Ce
     * test verrouille leur coexistence : les fusionner reviendrait à traiter
     * un trouble comme une simple faiblesse.
     */
    it('enregistre difficulties et specificNeeds côte à côte, sans les confondre', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updatePedagogicalProfile(
        'user-uuid',
        { difficulties: 'Blocage sur les dérivées', specificNeeds: 'PAP dyslexie' },
        actor,
      );
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          difficulties: 'Blocage sur les dérivées',
          specificNeeds: 'PAP dyslexie',
        }),
      );
    });

    it('enregistre familyContext et schoolContext séparément sur le profil élève', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updatePedagogicalProfile(
        'user-uuid',
        {
          familyContext: 'Une sœur jumelle également suivie',
          schoolContext: 'Redoublement en seconde',
        },
        actor,
      );
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          familyContext: 'Une sœur jumelle également suivie',
          schoolContext: 'Redoublement en seconde',
        }),
      );
      // L'ancien champ unique ne doit surtout pas être réintroduit au passage.
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.not.objectContaining({ context: expect.anything() }),
      );
    });

    it('enregistre schoolName et equipment sur le profil élève', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updatePedagogicalProfile(
        'user-uuid',
        {
          schoolName: 'Lycée Montaigne, Bordeaux',
          equipment: 'Bureau dans sa chambre, ordinateur portable partagé, fibre',
        },
        actor,
      );
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          schoolName: 'Lycée Montaigne, Bordeaux',
          equipment: 'Bureau dans sa chambre, ordinateur portable partagé, fibre',
        }),
      );
    });

    // pickDefined ne doit poser que les champs réellement fournis : sans cela,
    // enregistrer le contexte familial seul écraserait le contexte scolaire.
    it('n’écrase pas schoolContext quand seul familyContext est fourni', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await service.updatePedagogicalProfile(
        'user-uuid',
        { familyContext: 'Fratrie de quatre' },
        actor,
      );
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.not.objectContaining({ schoolContext: expect.anything() }),
      );
    });

    it('enregistre les 4 nouveaux champs déclaratifs du formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await service.updatePedagogicalProfile(
        'teacher-uuid',
        {
          diplomas: 'CAPES 2018',
          specialties: ['Préparation Grand Oral', 'Remise à niveau'],
          particularities: 'Pas de créneau avant 14h',
          cvDocumentId: 'b0e3f6f2-9a1e-4f7b-9c1a-2f0f9d2b7c31',
        },
        actor,
      );
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          diplomas: 'CAPES 2018',
          specialties: ['Préparation Grand Oral', 'Remise à niveau'],
          particularities: 'Pas de créneau avant 14h',
          cvDocumentId: 'b0e3f6f2-9a1e-4f7b-9c1a-2f0f9d2b7c31',
        }),
      );
    });

    /**
     * Défaut corrigé : un champ appartenant à l'autre rôle était filtré en
     * silence et l'appelant recevait un 200 sur une écriture ignorée.
     */
    it('refuse en 400 un champ formateur envoyé sur un profil élève', async () => {
      const actor = makeActor(UserRole.ELEVE, 'user-uuid');
      await expect(
        service.updatePedagogicalProfile('user-uuid', { level: '3ème', diplomas: 'CAPES' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 un champ élève envoyé sur un profil formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await expect(
        service.updatePedagogicalProfile('teacher-uuid', { levels: ['Lycée'], goals: 'x' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
    });

    /**
     * Le rôle du compte prime sur l'heuristique par champs : un corps ne
     * contenant que `subjects` — champ commun aux deux profils — retombait
     * jusqu'ici systématiquement sur le profil formateur, y compris pour un
     * élève. C'était l'ambiguïté documentée en openPoint.
     */
    it('résout le profil cible depuis le rôle du compte quand seul subjects est envoyé', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await service.updatePedagogicalProfile('student-uuid', { subjects: ['Maths'] }, actor);
      expect(studentPedaRepo.save).toHaveBeenCalled();
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
    });

    it('retombe sur le profil existant quand identity-access-service est injoignable', async () => {
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('down'),
      );
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await service.updatePedagogicalProfile('student-uuid', { subjects: ['Maths'] }, actor);
      expect(studentPedaRepo.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Internal notes — PROF-FB-002
  // ---------------------------------------------------------------------------
  describe('getInternalNotes (PROF-FB-002)', () => {
    it('returns notes for RP', async () => {
      noteRepo.find.mockResolvedValue([{ id: 'note-1', content: 'ok' }]);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getInternalNotes('user-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('returns notes for AnimateurPedagogique', async () => {
      noteRepo.find.mockResolvedValue([{ id: 'note-2', content: 'ap note' }]);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.getInternalNotes('user-uuid', actor);
      expect(result).toHaveLength(1);
    });

    it('returns notes for TechnicienInformatique', async () => {
      noteRepo.find.mockResolvedValue([]);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(service.getInternalNotes('user-uuid', actor)).resolves.toEqual([]);
    });

    it('returns notes for AdministrateurFinancier', async () => {
      noteRepo.find.mockResolvedValue([]);
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(service.getInternalNotes('user-uuid', actor)).resolves.toEqual([]);
    });

    it('throws 403 for élève (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(service.getInternalNotes('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInternalNote (single — PROF-FB-002)', () => {
    const existingNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      content: 'Detail note',
    };

    it('RP can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('AP can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('TI can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('AF can retrieve a single note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      const result = await service.getInternalNote('user-uuid', 'note-uuid', actor);
      expect(result).toHaveProperty('id', 'note-uuid');
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.getInternalNote('user-uuid', 'unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 for élève (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ELEVE);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for parent_financeur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.PARENT_FINANCEUR);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for formateur (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.getInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createInternalNote (PROF-FB-002)', () => {
    it('RP can create an internal note', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.createInternalNote('user-uuid', { content: 'Note text' }, actor);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('content', 'Note text');
    });

    it('AP can create an internal note', async () => {
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      const result = await service.createInternalNote('user-uuid', { content: 'AP note' }, actor);
      expect(noteRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('content', 'AP note');
    });

    it('throws 403 when AdministrateurFinancier tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.createInternalNote('user-uuid', { content: 'af note' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(
        service.createInternalNote('user-uuid', { content: 'ti note' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to create a note (PROF-FB-002)', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.createInternalNote('user-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateInternalNote (PROF-FB-002)', () => {
    const rpAuthoredNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      authorRole: UserRole.RESPONSABLE_PEDAGOGIQUE,
      content: 'Original content',
    };
    const apAuthoredNote = {
      id: 'note-uuid-2',
      targetUserId: 'user-uuid',
      authorId: 'ap-uuid',
      authorRole: UserRole.ANIMATEUR_PEDAGOGIQUE,
      content: 'AP original content',
    };

    it('RP author can update their own note', async () => {
      noteRepo.findOne.mockResolvedValue(rpAuthoredNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      const result = await service.updateInternalNote('user-uuid', 'note-uuid', { content: 'Updated' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Updated' }));
    });

    it('any RP can update a note even if not the author', async () => {
      noteRepo.findOne.mockResolvedValue(apAuthoredNote);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'other-rp-uuid');
      const result = await service.updateInternalNote('user-uuid', 'note-uuid-2', { content: 'RP override' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'RP override' }));
    });

    it('AP author can update their own note', async () => {
      noteRepo.findOne.mockResolvedValue(apAuthoredNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid');
      await service.updateInternalNote('user-uuid', 'note-uuid-2', { content: 'AP updated' }, actor);
      expect(noteRepo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'AP updated' }));
    });

    it('throws 403 when AP tries to update another author note', async () => {
      noteRepo.findOne.mockResolvedValue(rpAuthoredNote);
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE, 'different-ap-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to update a note', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when AF tries to update a note', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER, 'af-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'note-uuid', { content: 'hack' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await expect(
        service.updateInternalNote('user-uuid', 'unknown-uuid', { content: 'x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInternalNote (PROF-FB-002)', () => {
    const existingNote = {
      id: 'note-uuid',
      targetUserId: 'user-uuid',
      authorId: 'rp-uuid',
      content: 'To be deleted',
    };

    it('RP can delete a note', async () => {
      noteRepo.findOne.mockResolvedValue(existingNote);
      noteRepo.remove = jest.fn().mockResolvedValue(undefined);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).resolves.toBeUndefined();
      expect(noteRepo.remove).toHaveBeenCalledWith(existingNote);
    });

    it('throws 403 when AP tries to delete a note (RP only)', async () => {
      const actor = makeActor(UserRole.ANIMATEUR_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when TI tries to delete a note', async () => {
      const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when AF tries to delete a note', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when formateur tries to delete a note', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.deleteInternalNote('user-uuid', 'note-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when note does not exist', async () => {
      noteRepo.findOne.mockResolvedValue(null);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.deleteInternalNote('user-uuid', 'unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // promoteToAnimateurPedagogique — PROF-BR-008
  // ---------------------------------------------------------------------------
  describe('promoteToAnimateurPedagogique', () => {
    it('RP can promote a teacher to AP', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.promoteToAnimateurPedagogique('teacher-uuid', actor);
      expect(result).toHaveProperty('isAnimateurPedagogique', true);
      expect(eventsService.publish).toHaveBeenCalledWith(
        'TeacherPromotedToPedagogicalAnimator',
        expect.objectContaining({ teacherId: 'teacher-uuid' }),
      );
    });

    it('sets flag on existing profile', async () => {
      teacherPedaRepo.findOne.mockResolvedValue({ userId: 'teacher-uuid', isAnimateurPedagogique: false });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await service.promoteToAnimateurPedagogique('teacher-uuid', actor);
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isAnimateurPedagogique: true }),
      );
    });

    it('throws 403 when non-RP tries to promote', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.promoteToAnimateurPedagogique('teacher-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTeacherValidation
  // ---------------------------------------------------------------------------
  // La machine a etats est : pending → in_review → validated | rejected.
  // Le RP doit d'abord prendre le dossier en charge (pending → in_review) avant
  // de pouvoir le valider ou le rejeter ; seul le TI peut court-circuiter cette
  // etape (pending → validated/rejected en direct, bypass administratif).
  // Un enregistrement absent equivaut au statut 'pending'.
  describe('updateTeacherValidation', () => {
    /** Helper : positionne le statut courant du dossier de validation. */
    const withCurrentStatus = (status: string) =>
      teacherValidationRepo.findOne.mockResolvedValue({
        id: 'existing-uuid',
        teacherId: 'teacher-uuid',
        status,
        validatedBy: null,
        comment: null,
      });

    describe('pending → in_review (prise en charge, RP uniquement)', () => {
      it('RP can take a pending teacher file in review', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
        const dto = { status: 'in_review' as const };

        await service.updateTeacherValidation('teacher-uuid', dto, actor);

        expect(teacherValidationRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'in_review', validatedBy: actor.id }),
        );
        expect(eventsService.publish).not.toHaveBeenCalled();
      });

      it('throws 403 when TI tries to move pending → in_review (RP only)', async () => {
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'in_review' }, actor),
        ).rejects.toThrow(ForbiddenException);
        expect(teacherValidationRepo.save).not.toHaveBeenCalled();
      });
    });

    describe('in_review → validated | rejected (RP ou TI)', () => {
      it('RP can validate a teacher already in review and publishes TeacherValidated', async () => {
        withCurrentStatus('in_review');
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor);

        expect(teacherValidationRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'validated', validatedBy: actor.id }),
        );
        expect(eventsService.publish).toHaveBeenCalledWith(
          'TeacherValidated',
          expect.objectContaining({ teacherId: 'teacher-uuid' }),
        );
      });

      it('TI can validate a teacher already in review', async () => {
        withCurrentStatus('in_review');
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
        ).resolves.toBeDefined();
      });

      it('RP can reject a teacher already in review, without publishing TeacherValidated', async () => {
        withCurrentStatus('in_review');
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await service.updateTeacherValidation(
          'teacher-uuid',
          { status: 'rejected', comment: 'Dossier incomplet' },
          actor,
        );

        expect(teacherValidationRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'rejected', comment: 'Dossier incomplet' }),
        );
        expect(eventsService.publish).not.toHaveBeenCalled();
      });

      it('TI can reject a teacher already in review', async () => {
        withCurrentStatus('in_review');
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);
        const dto = { status: 'rejected' as const, comment: 'Documents manquants' };

        await expect(
          service.updateTeacherValidation('teacher-uuid', dto, actor),
        ).resolves.toBeDefined();
      });
    });

    describe('pending → validated | rejected (bypass TI uniquement)', () => {
      it('TI can validate directly from pending (bypass) and publishes TeacherValidated', async () => {
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);

        await service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor);

        expect(eventsService.publish).toHaveBeenCalledWith(
          'TeacherValidated',
          expect.objectContaining({ teacherId: 'teacher-uuid' }),
        );
      });

      it('TI can reject directly from pending (bypass), without publishing TeacherValidated', async () => {
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);

        await service.updateTeacherValidation('teacher-uuid', { status: 'rejected' }, actor);

        expect(eventsService.publish).not.toHaveBeenCalled();
      });

      it('throws 403 when RP tries to validate directly from pending (must take in review first)', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
        ).rejects.toThrow(ForbiddenException);
        expect(teacherValidationRepo.save).not.toHaveBeenCalled();
        expect(eventsService.publish).not.toHaveBeenCalled();
      });

      it('throws 403 when RP tries to reject directly from pending', async () => {
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'rejected' }, actor),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('transition vers le statut courant', () => {
      it('throws 403 when the target status is already the current one (in_review)', async () => {
        withCurrentStatus('in_review');
        const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'in_review' }, actor),
        ).rejects.toThrow(ForbiddenException);
        expect(teacherValidationRepo.save).not.toHaveBeenCalled();
      });

      it('throws 403 when re-validating an already validated teacher', async () => {
        withCurrentStatus('validated');
        const actor = makeActor(UserRole.TECHNICIEN_INFORMATIQUE);

        await expect(
          service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
        ).rejects.toThrow(ForbiddenException);
        expect(eventsService.publish).not.toHaveBeenCalled();
      });
    });

    it('creates the validation record when none exists yet (absence = pending)', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await service.updateTeacherValidation('teacher-uuid', { status: 'in_review' }, actor);

      expect(teacherValidationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teacherId: 'teacher-uuid',
          status: 'in_review',
          validatedBy: actor.id,
          validatorRole: actor.role,
        }),
      );
    });

    it('updates the existing validation record instead of creating a new one', async () => {
      withCurrentStatus('in_review');
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor);

      expect(teacherValidationRepo.create).not.toHaveBeenCalled();
      expect(teacherValidationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-uuid',
          status: 'validated',
          validatedBy: actor.id,
        }),
      );
    });

    it('throws 403 for formateur', async () => {
      const actor = makeActor(UserRole.FORMATEUR);
      await expect(
        service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for AdministrateurFinancier', async () => {
      const actor = makeActor(UserRole.ADMINISTRATEUR_FINANCIER);
      await expect(
        service.updateTeacherValidation('teacher-uuid', { status: 'validated' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // bootstrapTeacherValidation — arbitrage du 2026-08-12
  //
  // Tout compte formateur porte un enregistrement de validation, CRÉÉ À
  // L'INSCRIPTION. Sans lui, le formateur n'apparaît dans aucune file du RP :
  // jamais vu, jamais validé, jamais proposable.
  // ---------------------------------------------------------------------------
  describe('bootstrapTeacherValidation', () => {
    it("crée l'enregistrement au statut pending quand aucun n'existe", async () => {
      teacherValidationRepo.findOne.mockResolvedValue(null);
      teacherValidationRepo.create.mockImplementation((data: unknown) => data);
      teacherValidationRepo.save.mockImplementation(async (data: unknown) => ({
        id: 'v-new',
        ...(data as object),
      }));

      const { validation, isCreated } =
        await service.bootstrapTeacherValidation('teacher-uuid');

      expect(isCreated).toBe(true);
      expect(teacherValidationRepo.create).toHaveBeenCalledWith({
        teacherId: 'teacher-uuid',
        status: 'pending',
      });
      expect(validation).toMatchObject({ teacherId: 'teacher-uuid', status: 'pending' });
    });

    it('est idempotent : un enregistrement pending existant est renvoyé sans réécriture', async () => {
      const existing = { id: 'v1', teacherId: 'teacher-uuid', status: 'pending' };
      teacherValidationRepo.findOne.mockResolvedValue(existing);

      const { validation, isCreated } =
        await service.bootstrapTeacherValidation('teacher-uuid');

      expect(isCreated).toBe(false);
      expect(validation).toBe(existing);
      expect(teacherValidationRepo.save).not.toHaveBeenCalled();
    });

    // Cas d'erreur le plus grave : repasser un formateur validé en pending
    // annulerait la décision d'un RP sans trace, et rouvrirait l'accès d'un
    // formateur refusé.
    it.each(['validated', 'rejected', 'in_review'])(
      'ne repasse JAMAIS un formateur « %s » à pending',
      async (status) => {
        const existing = { id: 'v1', teacherId: 'teacher-uuid', status };
        teacherValidationRepo.findOne.mockResolvedValue(existing);

        const { validation, isCreated } =
          await service.bootstrapTeacherValidation('teacher-uuid');

        expect(isCreated).toBe(false);
        expect(validation).toHaveProperty('status', status);
        expect(teacherValidationRepo.save).not.toHaveBeenCalled();
        expect(teacherValidationRepo.create).not.toHaveBeenCalled();
      },
    );
  });

  // ---------------------------------------------------------------------------
  // getTeacherValidation
  // ---------------------------------------------------------------------------
  describe('getTeacherValidation', () => {
    it('returns validation record for RP', async () => {
      teacherValidationRepo.findOne.mockResolvedValue({
        id: 'v-uuid',
        teacherId: 'teacher-uuid',
        status: 'validated',
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getTeacherValidation('teacher-uuid', actor);
      expect(result).toHaveProperty('status', 'validated');
    });

    /**
     * Le repli de synthèse SUBSISTE — refuser la lecture n'aiderait ni le
     * formateur ni le RP — mais il ne doit plus MASQUER (arbitrage du
     * 2026-08-12, point 2). C'est l'absorption silencieuse qui faisait mentir
     * l'écran : le formateur se croyait en attente d'examen alors que personne
     * ne devait jamais l'examiner.
     */
    it("renvoie un pending de repli quand aucun enregistrement n'existe, ET TRACE l'anomalie", async () => {
      const logAnomaly = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      const result = await service.getTeacherValidation('teacher-uuid', actor);

      expect(result).toEqual({ teacherId: 'teacher-uuid', status: 'pending' });
      expect(logAnomaly).toHaveBeenCalledTimes(1);
      expect(logAnomaly.mock.calls[0][0]).toContain('ANOMALIE DE DONNEES');
      expect(logAnomaly.mock.calls[0][0]).toContain('teacher-uuid');
      logAnomaly.mockRestore();
    });

    it("ne trace aucune anomalie quand l'enregistrement existe", async () => {
      const logAnomaly = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      teacherValidationRepo.findOne.mockResolvedValue({
        id: 'v-uuid',
        teacherId: 'teacher-uuid',
        status: 'pending',
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);

      await service.getTeacherValidation('teacher-uuid', actor);

      expect(logAnomaly).not.toHaveBeenCalled();
      logAnomaly.mockRestore();
    });

    it('teacher can view their own validation status', async () => {
      teacherValidationRepo.findOne.mockResolvedValue({ teacherId: 'teacher-uuid', status: 'pending' });
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      const result = await service.getTeacherValidation('teacher-uuid', actor);
      expect(result).toHaveProperty('teacherId', 'teacher-uuid');
    });

    it('throws 403 when formateur tries to view another teacher validation', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'other-teacher-uuid');
      await expect(
        service.getTeacherValidation('teacher-uuid', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // getPedagogicalStatistics
  // ---------------------------------------------------------------------------
  describe('getPedagogicalStatistics', () => {
    it('returns student statistics for RP', async () => {
      studentPedaRepo.findOne.mockResolvedValue({
        userId: 'student-uuid',
        level: 'Terminale',
        subjects: ['Mathématiques'],
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getPedagogicalStatistics('student-uuid', actor);
      expect(result).toHaveProperty('profileType', 'student');
      expect(result.statistics).toHaveProperty('level', 'Terminale');
    });

    it('returns teacher statistics for RP', async () => {
      teacherPedaRepo.findOne.mockResolvedValue({
        userId: 'teacher-uuid',
        levels: ['Lycée'],
        subjects: ['Mathématiques'],
        isAnimateurPedagogique: false,
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      const result = await service.getPedagogicalStatistics('teacher-uuid', actor);
      expect(result).toHaveProperty('profileType', 'teacher');
      expect(result.statistics).toHaveProperty('isAnimateurPedagogique', false);
    });

    it('throws 404 when no pedagogical profile exists', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE);
      await expect(
        service.getPedagogicalStatistics('unknown-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('élève can view own statistics', async () => {
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid', level: '3ème' });
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      const result = await service.getPedagogicalStatistics('student-uuid', actor);
      expect(result.userId).toBe('student-uuid');
    });

    /**
     * Ce test attendait un 403 : c'était le comportement d'avant l'arbitrage du
     * 2026-08-11, quand le refus annonçait « cette personne existe, mais pas
     * pour vous ». Il attend désormais un 404 — même code et même message qu'une
     * absence de statistiques. Ce n'est pas un assouplissement : l'accès reste
     * refusé, il ne dit simplement plus ce qu'il refuse.
     */
    it('refuse en 404 un élève qui consulte les statistiques d\'un tiers non relié', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(
        service.getPedagogicalStatistics('other-uuid', actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePrescription — section réservée au RP
  // ---------------------------------------------------------------------------
  describe('updatePrescription — droits', () => {
    it('le RP écrit la prescription d’un élève', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await service.updatePrescription(
        'student-uuid',
        { generalAssessment: 'Élève sérieux', recommendedPace: '2h/semaine' },
        actor,
      );
      expect(studentPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          generalAssessment: 'Élève sérieux',
          recommendedPace: '2h/semaine',
        }),
      );
    });

    it('le RP écrit la prescription d’un formateur', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await service.updatePrescription(
        'teacher-uuid',
        { maxValidatedLevel: 'Terminale', testResults: '87/100' },
        actor,
      );
      expect(teacherPedaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ maxValidatedLevel: 'Terminale', testResults: '87/100' }),
      );
    });

    /**
     * Cœur du chantier : le titulaire LIT sa prescription mais ne l'écrit
     * jamais, y compris sur son propre profil. Un simple contrôle « je modifie
     * mon profil » aurait laissé passer ces deux cas.
     */
    it('refuse explicitement qu’un élève écrive sa propre prescription', async () => {
      const actor = makeActor(UserRole.ELEVE, 'student-uuid');
      await expect(
        service.updatePrescription('student-uuid', { generalAssessment: 'Je suis excellent' }, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
    });

    it('refuse explicitement qu’un formateur écrive ses propres résultats de test', async () => {
      const actor = makeActor(UserRole.FORMATEUR, 'teacher-uuid');
      await expect(
        service.updatePrescription('teacher-uuid', { testResults: '100/100' }, actor),
      ).rejects.toThrow(ForbiddenException);
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      [UserRole.PARENT_FINANCEUR, 'parent-uuid'],
      [UserRole.ANIMATEUR_PEDAGOGIQUE, 'ap-uuid'],
      [UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid'],
      [UserRole.ADMINISTRATEUR_FINANCIER, 'af-uuid'],
    ])('refuse le rôle %s sur la prescription', async (role, id) => {
      const actor = makeActor(role, id);
      await expect(
        service.updatePrescription('student-uuid', { generalAssessment: 'x' }, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePrescription — filledBy / filledAt', () => {
    it('renseigne filledBy avec l’acteur authentifié et filledAt côté serveur', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      const before = Date.now();
      await service.updatePrescription('student-uuid', { recommendedPath: 'Parcours A' }, actor);

      const saved = studentPedaRepo.save.mock.calls[0][0];
      expect(saved.filledBy).toBe('rp-uuid');
      expect(saved.filledAt).toBeInstanceOf(Date);
      expect(saved.filledAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('ne prend jamais filledBy depuis le corps de la requête', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      // Un client malveillant tenterait d'attribuer la prescription à un autre RP.
      // Le DTO ne porte pas ces champs (400 via forbidNonWhitelisted côté HTTP) ;
      // même en les forçant jusqu'au service, l'acteur authentifié l'emporte.
      await service.updatePrescription(
        'student-uuid',
        { recommendedPath: 'Parcours A', filledBy: 'someone-else' } as never,
        actor,
      );
      expect(studentPedaRepo.save.mock.calls[0][0].filledBy).toBe('rp-uuid');
    });

    it('écrase filledBy/filledAt d’une prescription existante', async () => {
      studentPedaRepo.findOne.mockResolvedValue({
        userId: 'student-uuid',
        filledBy: 'previous-rp',
        filledAt: new Date('2020-01-01'),
      });
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await service.updatePrescription('student-uuid', { recommendedPace: '1h' }, actor);

      const saved = studentPedaRepo.save.mock.calls[0][0];
      expect(saved.filledBy).toBe('rp-uuid');
      expect(saved.filledAt.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
    });
  });

  describe('updatePrescription — champs du mauvais rôle', () => {
    it('refuse en 400 un champ formateur sur un profil élève', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await expect(
        service.updatePrescription('student-uuid', { maxValidatedLevel: 'Terminale' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 un champ élève sur un profil formateur', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await expect(
        service.updatePrescription('teacher-uuid', { recommendedPace: '2h' }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 un corps mélangeant les deux rôles', async () => {
      const actor = makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid');
      await expect(
        service.updatePrescription(
          'student-uuid',
          { recommendedPace: '2h', maxValidatedLevel: 'Terminale' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // System bootstrap ports — consumed by InternalService / ParentLinkRequestsService
  // ---------------------------------------------------------------------------
  describe('bootstrapAdministrativeProfile', () => {
    it('creates a minimal administrative profile for a new user', async () => {
      const dto = { userId: 'new-uuid', firstName: 'Marie', lastName: 'Dupont', phone: '+33600000001' };
      const result = await service.bootstrapAdministrativeProfile(dto);
      expect(adminRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'new-uuid', firstName: 'Marie', lastName: 'Dupont', phone: '+33600000001' }),
      );
      expect(adminRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('userId', 'new-uuid');
    });

    it('is idempotent: does not duplicate and does not call save when nothing changes', async () => {
      const existing = { userId: 'existing-uuid', firstName: 'Marie' };
      adminRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapAdministrativeProfile({ userId: 'existing-uuid' });
      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('upserts: updates an already-existing empty profile (lazy-init row) with the incoming name', async () => {
      const existing = { userId: 'existing-uuid', firstName: undefined, lastName: undefined };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', firstName: 'Marie', lastName: 'Dupont' }),
      );
      expect(result).toHaveProperty('firstName', 'Marie');
      expect(result).toHaveProperty('lastName', 'Dupont');
    });

    it('upserts: overwrites an already-populated profile with the incoming name (replayed bootstrap call)', async () => {
      const existing = { userId: 'existing-uuid', firstName: 'OldFirst', lastName: 'OldLast' };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'NewFirst',
        lastName: 'NewLast',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', firstName: 'NewFirst', lastName: 'NewLast' }),
      );
      expect(result).toHaveProperty('firstName', 'NewFirst');
      expect(result).toHaveProperty('lastName', 'NewLast');
    });

    it('upserts: updates phone on an already-existing profile, alongside the name', async () => {
      const existing = {
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000001',
      };
      adminRepo.findOne.mockResolvedValue(existing);
      adminRepo.save.mockImplementation(async (entity) => entity);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000002',
      });
      expect(adminRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'existing-uuid', phone: '+33600000002' }),
      );
      expect(result).toHaveProperty('phone', '+33600000002');
    });

    it('does not call save when the incoming phone matches the existing one (no spurious writes)', async () => {
      const existing = {
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000001',
      };
      adminRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapAdministrativeProfile({
        userId: 'existing-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        phone: '+33600000001',
      });
      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('bootstrapStudentPedagogicalProfile', () => {
    it('creates a student pedagogical profile mapping level to level', async () => {
      const result = await service.bootstrapStudentPedagogicalProfile({ userId: 'student-uuid', level: 'Terminale' });
      expect(studentPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'student-uuid', level: 'Terminale' }),
      );
      expect(result).toHaveProperty('userId', 'student-uuid');
    });

    it('is idempotent: does not duplicate when profile already exists', async () => {
      const existing = { userId: 'student-uuid', level: 'Terminale' };
      studentPedaRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapStudentPedagogicalProfile({ userId: 'student-uuid' });
      expect(studentPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('bootstrapTeacherPedagogicalProfile', () => {
    it('creates a teacher pedagogical profile mapping subjects/levels/bio', async () => {
      const dto = { userId: 'teacher-uuid', subjects: ['Mathématiques'], levels: ['Lycée'], bio: '5 ans' };
      const result = await service.bootstrapTeacherPedagogicalProfile(dto);
      expect(teacherPedaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'teacher-uuid',
          subjects: ['Mathématiques'],
          levels: ['Lycée'],
          experience: '5 ans',
        }),
      );
      expect(result).toHaveProperty('userId', 'teacher-uuid');
    });

    it('is idempotent: does not duplicate when profile already exists', async () => {
      const existing = { userId: 'teacher-uuid' };
      teacherPedaRepo.findOne.mockResolvedValue(existing);
      const result = await service.bootstrapTeacherPedagogicalProfile({ userId: 'teacher-uuid' });
      expect(teacherPedaRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });

  describe('studentPedagogicalProfileExists', () => {
    it('returns true when a student pedagogical profile exists', async () => {
      studentPedaRepo.findOne.mockResolvedValue({ userId: 'student-uuid' });
      await expect(service.studentPedagogicalProfileExists('student-uuid')).resolves.toBe(true);
    });

    it('returns false when no student pedagogical profile exists', async () => {
      studentPedaRepo.findOne.mockResolvedValue(null);
      await expect(service.studentPedagogicalProfileExists('unknown-uuid')).resolves.toBe(false);
    });
  });
});
