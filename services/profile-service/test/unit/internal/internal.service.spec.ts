import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InternalService } from '../../../src/internal/internal.service';
import { ProfilesService } from '../../../src/profiles/profiles.service';
import { RelationsService } from '../../../src/relations/relations.service';
import { AdministrativeProfileLookupService } from '../../../src/profiles/administrative-profile-lookup.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';
import { toAdministrativeProfileView } from '../../../src/profiles/administrative-profile.view';
import { UserRole } from '../../../src/common/enums/user-role.enum';

describe('InternalService', () => {
  let service: InternalService;
  let profilesService: any;
  let relationsService: any;
  let administrativeProfileLookup: any;
  let identityAccessClient: any;

  beforeEach(async () => {
    profilesService = {
      bootstrapAdministrativeProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
      })),
      bootstrapStudentPedagogicalProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        level: dto.level,
      })),
      bootstrapTeacherPedagogicalProfile: jest.fn().mockImplementation(async (dto) => ({
        userId: dto.userId,
        subjects: dto.subjects,
        levels: dto.levels,
      })),
      /**
       * Le VRAI projecteur, pas un passe-plat : c'est lui qui écarte les champs
       * de stockage de la photo et construit `avatarUrl`. Le simuler par
       * l'identité laisserait passer une fuite d'`avatarObjectKey` sur les
       * routes `/internal/*` sans qu'aucun test ne bronche.
       */
      presentAdministrativeProfile: jest
        .fn()
        .mockImplementation((profile) => toAdministrativeProfileView(profile)),
      /**
       * Idempotent et non destructeur côté ProfilesService (testé là-bas) :
       * on simule ici la création, `isCreated` disant lequel des deux cas
       * s'est produit.
       */
      bootstrapTeacherValidation: jest.fn().mockImplementation(async (teacherId) => ({
        validation: { id: 'v-1', teacherId, status: 'pending' },
        isCreated: true,
      })),
    };

    relationsService = {
      createFinanceOwnerStudentLinkForSystem: jest.fn().mockImplementation(async (financeOwnerId, studentId) => ({
        financeOwnerId,
        studentId,
      })),
      ensureTeacherStudentLinkForSystem: jest
        .fn()
        .mockImplementation(async (teacherId, studentId, isPrincipalTeacher = false) => ({
          link: { teacherId, studentId, isPrincipalTeacher },
          isCreated: true,
        })),
      createPedagogicalCoordinatorLinkForSystem: jest
        .fn()
        .mockImplementation(async (coordinatorId, studentId, coordinatorRole) => ({
          coordinatorId,
          studentId,
          coordinatorRole,
        })),
      getFinanceOwnersByStudent: jest.fn().mockResolvedValue([]),
      getTeachersByStudent: jest.fn().mockResolvedValue([]),
    };

    administrativeProfileLookup = {
      findNamesByUserIds: jest.fn().mockResolvedValue(new Map()),
    };

    identityAccessClient = {
      findAccountByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalService,
        { provide: ProfilesService, useValue: profilesService },
        { provide: RelationsService, useValue: relationsService },
        { provide: AdministrativeProfileLookupService, useValue: administrativeProfileLookup },
        { provide: IdentityAccessClient, useValue: identityAccessClient },
      ],
    }).compile();

    service = module.get<InternalService>(InternalService);
  });

  // ---------------------------------------------------------------------------
  // createAdministrativeProfile
  // ---------------------------------------------------------------------------
  describe('createAdministrativeProfile', () => {
    it('delegates to ProfilesService.bootstrapAdministrativeProfile and shapes the response', async () => {
      const dto = { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont' };
      const result = await service.createAdministrativeProfile(dto);
      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        userId: 'parent-uuid',
        administrative: { userId: 'parent-uuid', firstName: 'Marie', lastName: 'Dupont' },
      });
      // Le bloc est projeté : `avatarUrl` est exposé (null faute de photo), les
      // champs de stockage ne le sont jamais.
      expect(result.administrative).toHaveProperty('avatarUrl', null);
      expect(result.administrative).not.toHaveProperty('avatarObjectKey');
      expect(result.administrative).not.toHaveProperty('avatarContentType');
    });

    it('propagates errors raised by ProfilesService', async () => {
      profilesService.bootstrapAdministrativeProfile.mockRejectedValue(new ConflictException('boom'));
      await expect(
        service.createAdministrativeProfile({ userId: 'rp-uuid', firstName: 'Jean', lastName: 'Martin' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // createStudentProfiles
  // ---------------------------------------------------------------------------
  describe('createStudentProfiles', () => {
    it('bootstraps both administrative and student pedagogical profiles', async () => {
      const dto = { userId: 'student-uuid', firstName: 'Alice', level: 'Terminale' };
      const result = await service.createStudentProfiles(dto);

      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(profilesService.bootstrapStudentPedagogicalProfile).toHaveBeenCalledWith(dto);
      expect(result).toMatchObject({
        userId: 'student-uuid',
        administrative: { userId: 'student-uuid', firstName: 'Alice', lastName: null },
        pedagogical: { userId: 'student-uuid', level: 'Terminale' },
      });
      expect(result.administrative).not.toHaveProperty('avatarObjectKey');
    });
  });

  // ---------------------------------------------------------------------------
  // createTeacherProfiles
  // ---------------------------------------------------------------------------
  describe('createTeacherProfiles', () => {
    it('bootstraps both administrative and teacher pedagogical profiles', async () => {
      const dto = { userId: 'teacher-uuid', subjects: ['Mathématiques'], levels: ['Lycée'] };
      const result = await service.createTeacherProfiles(dto);

      expect(profilesService.bootstrapAdministrativeProfile).toHaveBeenCalledWith(dto);
      expect(profilesService.bootstrapTeacherPedagogicalProfile).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('userId', 'teacher-uuid');
      expect(result).toHaveProperty('pedagogical.subjects', ['Mathématiques']);
    });

    /**
     * Arbitrage du 2026-08-12 : tout compte formateur porte un enregistrement
     * de validation, créé à l'inscription. Sans lui, le formateur n'apparaît
     * dans aucune file du RP — jamais vu, jamais validé, jamais proposable.
     */
    it("crée l'enregistrement de validation et le renvoie dans la réponse", async () => {
      const result = await service.createTeacherProfiles({ userId: 'teacher-uuid' });

      expect(profilesService.bootstrapTeacherValidation).toHaveBeenCalledWith('teacher-uuid');
      expect(result).toHaveProperty('validation.status', 'pending');
      expect(result).toHaveProperty('validation.teacherId', 'teacher-uuid');
    });
  });

  // ---------------------------------------------------------------------------
  // Enregistrement de validation à l'inscription — arbitrage du 2026-08-12
  //
  // C'est `create-administrative-profile` que `POST /accounts/teachers`
  // emprunte réellement (mesuré contre la pile le 2026-08-12), et non
  // `create-teacher-profiles`. Le déclenchement doit donc exister ici aussi,
  // sans quoi la correction ne vaudrait que pour un chemin que l'inscription
  // n'emprunte pas.
  // ---------------------------------------------------------------------------
  describe('createAdministrativeProfile — enregistrement de validation', () => {
    const teacherDto = {
      userId: 'teacher-uuid',
      firstName: 'Jean',
      lastName: 'Formateur',
      role: UserRole.FORMATEUR,
    };

    it("crée l'enregistrement de validation quand le rôle est formateur", async () => {
      await service.createAdministrativeProfile(teacherDto);

      expect(profilesService.bootstrapTeacherValidation).toHaveBeenCalledWith('teacher-uuid');
    });

    it.each([
      UserRole.ELEVE,
      UserRole.PARENT_FINANCEUR,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
    ])('ne crée aucun enregistrement de validation pour le rôle %s', async (role) => {
      await service.createAdministrativeProfile({
        userId: 'user-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
        role,
      });

      expect(profilesService.bootstrapTeacherValidation).not.toHaveBeenCalled();
    });

    /**
     * Rien n'est deviné : sans rôle transmis, aucun enregistrement n'est créé.
     * Mais l'omission a des conséquences (un formateur resterait invisible),
     * elle est donc journalisée — un champ manquant qui compte ne doit pas
     * passer inaperçu.
     */
    it('sans rôle transmis : ne crée rien et journalise un avertissement', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await service.createAdministrativeProfile({
        userId: 'user-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
      });

      expect(profilesService.bootstrapTeacherValidation).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('user-uuid'));
      warn.mockRestore();
    });

    it("le rôle n'apparaît pas dans la réponse : profile-service ne l'expose pas", async () => {
      const result = await service.createAdministrativeProfile(teacherDto);

      expect(result).not.toHaveProperty('role');
      expect(result.administrative).not.toHaveProperty('role');
    });
  });

  // ---------------------------------------------------------------------------
  // Reprise de stock — arbitrage du 2026-08-12, point 3
  // ---------------------------------------------------------------------------
  describe('ensureTeacherValidations', () => {
    it('sépare ce qui a été créé de ce qui existait déjà', async () => {
      profilesService.bootstrapTeacherValidation
        .mockResolvedValueOnce({ validation: {}, isCreated: true })
        .mockResolvedValueOnce({ validation: {}, isCreated: false });

      const result = await service.ensureTeacherValidations(['new-teacher', 'known-teacher']);

      expect(result).toEqual({
        created: ['new-teacher'],
        alreadyPresent: ['known-teacher'],
      });
    });

    it('réduit les doublons de la liste à un seul traitement', async () => {
      await service.ensureTeacherValidations(['teacher-1', 'teacher-1', 'teacher-1']);

      expect(profilesService.bootstrapTeacherValidation).toHaveBeenCalledTimes(1);
    });

    /**
     * Rejouer le script ne doit rien changer après le premier passage : c'est
     * ce qui rend la reprise de stock sûre à relancer.
     */
    it('est idempotent : un second passage ne crée plus rien', async () => {
      profilesService.bootstrapTeacherValidation.mockResolvedValue({
        validation: {},
        isCreated: false,
      });

      const result = await service.ensureTeacherValidations(['teacher-1', 'teacher-2']);

      expect(result.created).toEqual([]);
      expect(result.alreadyPresent).toEqual(['teacher-1', 'teacher-2']);
    });

    it('liste vide : ne touche à rien', async () => {
      const result = await service.ensureTeacherValidations([]);

      expect(result).toEqual({ created: [], alreadyPresent: [] });
      expect(profilesService.bootstrapTeacherValidation).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Verrou de nommage — arbitrage du 2026-08-08
  // ---------------------------------------------------------------------------
  /**
   * « Une même donnée porte un seul nom dans tout le système. » Les blocs de
   * profil s'appellent `administrative` / `pedagogical` partout. La paire longue
   * `administrativeProfile` / `pedagogicalProfile` que renvoyaient auparavant les
   * routes /internal/* a été supprimée sans alias de compatibilité : un alias
   * recréerait exactement la divergence que l'arbitrage résorbe.
   */
  describe('nommage des blocs de profil', () => {
    const FORBIDDEN_KEYS = ['administrativeProfile', 'pedagogicalProfile'];

    it('createAdministrativeProfile n\'expose pas la paire longue', async () => {
      const result = await service.createAdministrativeProfile({
        userId: 'parent-uuid',
        firstName: 'Marie',
        lastName: 'Dupont',
      });
      expect(Object.keys(result)).toEqual(['userId', 'administrative']);
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(result).not.toHaveProperty(forbiddenKey);
      }
    });

    it('createStudentProfiles n\'expose pas la paire longue', async () => {
      const result = await service.createStudentProfiles({ userId: 'student-uuid' });
      expect(Object.keys(result)).toEqual(['userId', 'administrative', 'pedagogical']);
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(result).not.toHaveProperty(forbiddenKey);
      }
    });

    it('createTeacherProfiles n\'expose pas la paire longue', async () => {
      const result = await service.createTeacherProfiles({ userId: 'teacher-uuid' });
      // `validation` s'ajoute depuis le 2026-08-12 : on renvoie l'état
      // enregistré plutôt que de laisser l'appelant le supposer.
      expect(Object.keys(result)).toEqual([
        'userId',
        'administrative',
        'pedagogical',
        'validation',
      ]);
      for (const forbiddenKey of FORBIDDEN_KEYS) {
        expect(result).not.toHaveProperty(forbiddenKey);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // linkParent
  // ---------------------------------------------------------------------------
  describe('linkParent', () => {
    it('delegates to RelationsService.createFinanceOwnerStudentLinkForSystem', async () => {
      const dto = { studentId: 'student-uuid', financeOwnerId: 'parent-uuid' };
      const result = await service.linkParent(dto);
      expect(relationsService.createFinanceOwnerStudentLinkForSystem).toHaveBeenCalledWith(
        'parent-uuid',
        'student-uuid',
      );
      expect(result).toEqual({ linked: true, contacts: ['parent-uuid'] });
    });

    it('throws 409 when parent is already linked to student', async () => {
      relationsService.createFinanceOwnerStudentLinkForSystem.mockRejectedValue(
        new ConflictException('already linked'),
      );
      const dto = { studentId: 'student-uuid', financeOwnerId: 'parent-uuid' };
      await expect(service.linkParent(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // createTeacherStudentRelation
  // ---------------------------------------------------------------------------
  describe('createTeacherStudentRelation', () => {
    it('creates a teacher–student link with isPrincipalTeacher defaulting to false', async () => {
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid' };
      const result = await service.createTeacherStudentRelation(dto);
      expect(relationsService.ensureTeacherStudentLinkForSystem).toHaveBeenCalledWith(
        'teacher-uuid',
        'student-uuid',
        false,
      );
      expect(result).toEqual({
        isCreated: true,
        relation: { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: false },
      });
    });

    it('creates a teacher–student link with isPrincipalTeacher set to true', async () => {
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true };
      const result = await service.createTeacherStudentRelation(dto);
      expect(result.relation).toHaveProperty('isPrincipalTeacher', true);
    });

    /**
     * Rejeu de la validation d'un RP : l'appelant obtient le même corps, avec
     * isCreated = false pour que le contrôleur réponde 200 et non 201. Aucune
     * erreur — c'est tout l'objet de l'idempotence demandée le 2026-08-12.
     */
    it('reports a replay (isCreated: false) instead of failing when the link already exists', async () => {
      relationsService.ensureTeacherStudentLinkForSystem.mockResolvedValue({
        link: { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: false },
        isCreated: false,
      });
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid' };
      const result = await service.createTeacherStudentRelation(dto);
      expect(result).toEqual({
        isCreated: false,
        relation: { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: false },
      });
    });

    /** Le seul conflit restant remonte tel quel : il n'est pas un rejeu. */
    it('propagates the 409 raised on a diverging isPrincipalTeacher', async () => {
      relationsService.ensureTeacherStudentLinkForSystem.mockRejectedValue(
        new ConflictException('statut de professeur principal différent'),
      );
      const dto = { teacherId: 'teacher-uuid', studentId: 'student-uuid', isPrincipalTeacher: true };
      await expect(service.createTeacherStudentRelation(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // resolveDisplayName / resolveDisplayNames
  // ---------------------------------------------------------------------------
  describe('resolveDisplayName', () => {
    it('renvoie UNIQUEMENT userId, firstName et lastName', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-uuid', { firstName: 'Camille', lastName: 'Durand' }]]),
      );

      const result = await service.resolveDisplayName('student-uuid');

      expect(result).toEqual({
        userId: 'student-uuid',
        firstName: 'Camille',
        lastName: 'Durand',
      });
      /**
       * Garde-fou du contrat figé (arbitrage du 2026-08-12) : la route est
       * servie sans lecteur et sans filtrage de visibilité. Tout champ
       * supplémentaire ferait d'elle une porte dérobée — ce test doit casser
       * si quelqu'un en ajoute un.
       */
      expect(Object.keys(result).sort()).toEqual(['firstName', 'lastName', 'userId']);
      expect(identityAccessClient.findAccountByUserId).not.toHaveBeenCalled();
    });

    it('accepte un nom partiellement vide sans échouer', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-uuid', { firstName: null, lastName: 'Durand' }]]),
      );

      await expect(service.resolveDisplayName('student-uuid')).resolves.toEqual({
        userId: 'student-uuid',
        firstName: null,
        lastName: 'Durand',
      });
    });

    it('404 quand identity-access-service ne connaît pas le userId', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(new Map());
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('unknown'),
      );

      await expect(service.resolveDisplayName('inconnu-uuid')).rejects.toThrow(NotFoundException);
    });

    it('500 quand le compte existe mais n’a aucun profil administratif (incohérence)', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(new Map());
      identityAccessClient.findAccountByUserId.mockResolvedValue({
        userId: 'orphelin-uuid',
        loginIdentifier: 'camille.durand',
        role: 'eleve',
      });

      await expect(service.resolveDisplayName('orphelin-uuid')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('500, et jamais 404, quand identity-access-service est injoignable', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(new Map());
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('timeout'),
      );

      await expect(service.resolveDisplayName('quelconque-uuid')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('propage le correlationId à identity-access-service', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(new Map());
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('unknown'),
      );

      await expect(service.resolveDisplayName('inconnu-uuid', 'corr-123')).rejects.toThrow(
        NotFoundException,
      );
      expect(identityAccessClient.findAccountByUserId).toHaveBeenCalledWith(
        'inconnu-uuid',
        'corr-123',
      );
    });
  });

  describe('resolveDisplayNames', () => {
    it('résout un lot en une seule requête, dans l’ordre d’entrée', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([
          ['student-uuid', { firstName: 'Camille', lastName: 'Durand' }],
          ['teacher-uuid', { firstName: 'Marie', lastName: 'Dupont' }],
        ]),
      );

      const result = await service.resolveDisplayNames(['student-uuid', 'teacher-uuid']);

      expect(administrativeProfileLookup.findNamesByUserIds).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        displayNames: [
          { userId: 'student-uuid', firstName: 'Camille', lastName: 'Durand' },
          { userId: 'teacher-uuid', firstName: 'Marie', lastName: 'Dupont' },
        ],
      });
    });

    it('réduit les doublons à une seule entrée', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-uuid', { firstName: 'Camille', lastName: 'Durand' }]]),
      );

      const result = await service.resolveDisplayNames(['student-uuid', 'student-uuid']);

      expect(result.displayNames).toHaveLength(1);
    });

    /**
     * Un identifiant douteux ne prive pas l'appelant des autres noms : il est
     * absent de la réponse, l'anomalie restant visible par un log serveur.
     */
    it('omet les userIds sans profil administratif sans faire échouer le lot', async () => {
      administrativeProfileLookup.findNamesByUserIds.mockResolvedValue(
        new Map([['student-uuid', { firstName: 'Camille', lastName: 'Durand' }]]),
      );

      const result = await service.resolveDisplayNames(['student-uuid', 'inconnu-uuid']);

      expect(result.displayNames).toEqual([
        { userId: 'student-uuid', firstName: 'Camille', lastName: 'Durand' },
      ]);
      expect(identityAccessClient.findAccountByUserId).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // linkCoordinator
  // ---------------------------------------------------------------------------
  describe('linkCoordinator', () => {
    it('creates a coordinator–student link', async () => {
      const dto = { coordinatorId: 'rp-uuid', studentId: 'student-uuid', coordinatorRole: 'responsable_pedagogique' };
      const result = await service.linkCoordinator(dto);
      expect(relationsService.createPedagogicalCoordinatorLinkForSystem).toHaveBeenCalledWith(
        'rp-uuid',
        'student-uuid',
        'responsable_pedagogique',
      );
      expect(result).toEqual(dto);
    });

    it('throws 409 when coordinator–student link already exists', async () => {
      relationsService.createPedagogicalCoordinatorLinkForSystem.mockRejectedValue(
        new ConflictException('already linked'),
      );
      const dto = { coordinatorId: 'rp-uuid', studentId: 'student-uuid', coordinatorRole: 'responsable_pedagogique' };
      await expect(service.linkCoordinator(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // getFinanceOwnersByStudent — arbitrage du 2026-08-14, point 5
  // ---------------------------------------------------------------------------
  describe('getFinanceOwnersByStudent', () => {
    it('délègue à RelationsService.getFinanceOwnersByStudent et ne renvoie que les userId', async () => {
      relationsService.getFinanceOwnersByStudent.mockResolvedValue([
        {
          financeOwnerId: 'parent-1-uuid',
          studentId: 'student-uuid',
          financeOwnerName: { firstName: 'Marie', lastName: 'Dupont' },
        },
        {
          financeOwnerId: 'parent-2-uuid',
          studentId: 'student-uuid',
          financeOwnerName: null,
        },
      ]);

      const result = await service.getFinanceOwnersByStudent('student-uuid');

      expect(relationsService.getFinanceOwnersByStudent).toHaveBeenCalledWith(
        'student-uuid',
        expect.objectContaining({ role: UserRole.RESPONSABLE_PEDAGOGIQUE }),
      );
      expect(result).toEqual({
        studentId: 'student-uuid',
        financeOwnerUserIds: ['parent-1-uuid', 'parent-2-uuid'],
      });
    });

    /**
     * Périmètre volontairement étroit (arbitrage du 2026-08-14) : ni nom, ni
     * statut de lien ne doivent fuiter par cette route. Un ajout de champ ici
     * serait une régression du même genre que sur `resolveDisplayName`.
     */
    it('ne renvoie que studentId et financeOwnerUserIds, rien d’autre', async () => {
      relationsService.getFinanceOwnersByStudent.mockResolvedValue([
        { financeOwnerId: 'parent-1-uuid', studentId: 'student-uuid', financeOwnerName: null },
      ]);

      const result = await service.getFinanceOwnersByStudent('student-uuid');

      expect(Object.keys(result).sort()).toEqual(['financeOwnerUserIds', 'studentId']);
    });

    it("renvoie une liste vide quand l'élève n'a aucun parent financeur actif", async () => {
      relationsService.getFinanceOwnersByStudent.mockResolvedValue([]);

      const result = await service.getFinanceOwnersByStudent('student-sans-parent-uuid');

      expect(result).toEqual({
        studentId: 'student-sans-parent-uuid',
        financeOwnerUserIds: [],
      });
    });

    it('propage les erreurs levées par RelationsService', async () => {
      relationsService.getFinanceOwnersByStudent.mockRejectedValue(new Error('boom'));

      await expect(service.getFinanceOwnersByStudent('student-uuid')).rejects.toThrow('boom');
    });
  });

  // ---------------------------------------------------------------------------
  // getTeachersByStudent — arbitrage du 2026-09-01 (refonte des Evaluations,
  // demande de correction humaine)
  // ---------------------------------------------------------------------------
  describe('getTeachersByStudent', () => {
    it('délègue à RelationsService.getTeachersByStudent et ne renvoie que les userId', async () => {
      relationsService.getTeachersByStudent.mockResolvedValue([
        {
          teacherId: 'teacher-1-uuid',
          studentId: 'student-uuid',
          isPrincipalTeacher: true,
          teacherName: { firstName: 'Camille', lastName: 'Durand' },
        },
        {
          teacherId: 'teacher-2-uuid',
          studentId: 'student-uuid',
          isPrincipalTeacher: false,
          teacherName: null,
        },
      ]);

      const result = await service.getTeachersByStudent('student-uuid');

      expect(relationsService.getTeachersByStudent).toHaveBeenCalledWith(
        'student-uuid',
        expect.objectContaining({ role: UserRole.RESPONSABLE_PEDAGOGIQUE }),
      );
      expect(result).toEqual({
        studentId: 'student-uuid',
        teacherUserIds: ['teacher-1-uuid', 'teacher-2-uuid'],
      });
    });

    /**
     * Périmètre volontairement étroit (même patron que getFinanceOwnersByStudent) :
     * ni nom, ni statut de lien ne doivent fuiter par cette route.
     */
    it('ne renvoie que studentId et teacherUserIds, rien d’autre', async () => {
      relationsService.getTeachersByStudent.mockResolvedValue([
        { teacherId: 'teacher-1-uuid', studentId: 'student-uuid', isPrincipalTeacher: false, teacherName: null },
      ]);

      const result = await service.getTeachersByStudent('student-uuid');

      expect(Object.keys(result).sort()).toEqual(['studentId', 'teacherUserIds']);
    });

    it("renvoie une liste vide quand l'élève n'a aucun professeur actif", async () => {
      relationsService.getTeachersByStudent.mockResolvedValue([]);

      const result = await service.getTeachersByStudent('student-sans-professeur-uuid');

      expect(result).toEqual({
        studentId: 'student-sans-professeur-uuid',
        teacherUserIds: [],
      });
    });

    it('propage les erreurs levées par RelationsService', async () => {
      relationsService.getTeachersByStudent.mockRejectedValue(new Error('boom'));

      await expect(service.getTeachersByStudent('student-uuid')).rejects.toThrow('boom');
    });
  });
});
