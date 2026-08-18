import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FieldVisibilityService } from '../../../src/profiles/field-visibility.service';
import { ProfileFieldVisibility } from '../../../src/profiles/entities/profile-field-visibility.entity';
import { FIELD_VISIBILITY_CATALOG } from '../../../src/profiles/field-visibility.catalog';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/common/types/actor.type';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../../../src/common/clients/identity-access.client';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

const OWNER_ID = 'student-uuid';

describe('FieldVisibilityService', () => {
  let service: FieldVisibilityService;
  let repo: any;
  let identityAccessClient: { findAccountByUserId: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (rows) => rows),
    };

    // Par défaut, OWNER_ID est un compte élève connu de identity-access-service —
    // c'est le rôle réel qui pilote le sous-catalogue exposé (arbitrage du
    // 2026-08-17), pas la présence d'un profil pédagogique.
    identityAccessClient = {
      findAccountByUserId: jest
        .fn()
        .mockResolvedValue({ userId: OWNER_ID, loginIdentifier: 'owner', role: 'eleve' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldVisibilityService,
        { provide: getRepositoryToken(ProfileFieldVisibility), useValue: repo },
        { provide: IdentityAccessClient, useValue: identityAccessClient },
      ],
    }).compile();

    service = module.get<FieldVisibilityService>(FieldVisibilityService);
  });

  // ---------------------------------------------------------------------------
  // Lecture
  // ---------------------------------------------------------------------------
  describe('getFieldVisibility', () => {
    it('renvoie le catalogue ADMINISTRATIF + PÉDAGOGIQUE ÉLÈVE pour un titulaire élève, jamais le bloc formateur', async () => {
      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));

      const expectedLength = FIELD_VISIBILITY_CATALOG.filter(
        (definition) => definition.block !== 'pedagogical-teacher',
      ).length;

      expect(view.userId).toBe(OWNER_ID);
      expect(view.fields).toHaveLength(expectedLength);
      expect(view.fields.every((field) => field.block !== 'pedagogical-teacher')).toBe(true);
      expect(view.fields.every((field) => field.isExplicit === false)).toBe(true);
    });

    it('renvoie le catalogue ADMINISTRATIF + PÉDAGOGIQUE FORMATEUR pour un titulaire formateur, jamais le bloc élève', async () => {
      identityAccessClient.findAccountByUserId.mockResolvedValue({
        userId: OWNER_ID,
        loginIdentifier: 'owner',
        role: 'formateur',
      });

      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.FORMATEUR, OWNER_ID));

      const expectedLength = FIELD_VISIBILITY_CATALOG.filter(
        (definition) => definition.block !== 'pedagogical-student',
      ).length;

      expect(view.fields).toHaveLength(expectedLength);
      expect(view.fields.every((field) => field.block !== 'pedagogical-student')).toBe(true);
      expect(view.fields.some((field) => field.block === 'pedagogical-teacher')).toBe(true);
    });

    it('un titulaire sans profil pédagogique (RP, parent…) n’a que le bloc administratif', async () => {
      identityAccessClient.findAccountByUserId.mockResolvedValue({
        userId: OWNER_ID,
        loginIdentifier: 'owner',
        role: 'responsable_pedagogique',
      });

      const view = await service.getFieldVisibility(
        OWNER_ID,
        makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, OWNER_ID),
      );

      expect(view.fields.every((field) => field.block === 'administrative')).toBe(true);
    });

    it('refuse en 404 quand identity-access-service ne connaît pas le titulaire', async () => {
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessNotFoundError('unknown'),
      );

      await expect(
        service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID)),
      ).rejects.toThrow(NotFoundException);
    });

    it('se dégrade au bloc administratif seul quand identity-access-service est indisponible', async () => {
      identityAccessClient.findAccountByUserId.mockRejectedValue(
        new IdentityAccessUnavailableError('timeout'),
      );

      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));

      expect(view.fields.every((field) => field.block === 'administrative')).toBe(true);
    });

    it('tout champ administrable a pour défaut `linked` depuis le 2026-08-17', async () => {
      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));

      expect(view.fields.every((field) => field.defaultAudience === 'linked')).toBe(true);
    });

    it('`firstName` et `lastName` ne figurent plus dans la réponse : ils ne sont plus réglables', async () => {
      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));

      expect(view.fields.find((field) => field.fieldName === 'firstName')).toBeUndefined();
      expect(view.fields.find((field) => field.fieldName === 'lastName')).toBeUndefined();
    });

    it('la dérogation enregistrée l’emporte sur le défaut et est signalée isExplicit', async () => {
      repo.find.mockResolvedValue([
        { userId: OWNER_ID, fieldName: 'difficulties', audience: 'self' },
      ]);

      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));
      const difficulties = view.fields.find((field) => field.fieldName === 'difficulties');

      expect(difficulties).toMatchObject({
        audience: 'self',
        defaultAudience: 'linked',
        isExplicit: true,
      });
    });

    it('expose isReserved pour un réglage sans colonne correspondante', async () => {
      const view = await service.getFieldVisibility(OWNER_ID, makeActor(UserRole.ELEVE, OWNER_ID));
      expect(view.fields.find((field) => field.fieldName === 'comments')?.isReserved).toBe(true);
    });

    it('un RP peut consulter les réglages d’un autre utilisateur', async () => {
      await expect(
        service.getFieldVisibility(OWNER_ID, makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, 'rp-uuid')),
      ).resolves.toBeDefined();
    });

    it('refuse en 403 un formateur qui consulte les réglages d’un élève', async () => {
      await expect(
        service.getFieldVisibility(OWNER_ID, makeActor(UserRole.FORMATEUR, 'teacher-uuid')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse en 403 un parent qui consulte les réglages d’un élève', async () => {
      await expect(
        service.getFieldVisibility(OWNER_ID, makeActor(UserRole.PARENT_FINANCEUR, 'parent-uuid')),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // Écriture
  // ---------------------------------------------------------------------------
  describe('updateFieldVisibility', () => {
    it('crée une dérogation pour un champ jamais réglé', async () => {
      await service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'difficulties', audience: 'self' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      expect(repo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: OWNER_ID,
          fieldName: 'difficulties',
          audience: 'self',
        }),
      ]);
    });

    it('met à jour une dérogation existante au lieu d’en créer une seconde', async () => {
      const existing = { id: 'row-1', userId: OWNER_ID, fieldName: 'phone', audience: 'self' };
      repo.find.mockImplementation(async ({ where }: any) =>
        where?.fieldName ? [existing] : [existing],
      );

      await service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'phone', audience: 'all' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith([expect.objectContaining({ id: 'row-1', audience: 'all' })]);
    });

    it('ne touche pas aux champs absents du corps (upsert partiel)', async () => {
      await service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'phone', audience: 'self' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      const savedRows = repo.save.mock.calls[0][0];
      expect(savedRows).toHaveLength(1);
      expect(savedRows[0].fieldName).toBe('phone');
    });

    /**
     * « Un champ inconnu doit être refusé et non absorbé en silence » : c'est
     * le défaut qui a coûté trois jours, il est verrouillé ici.
     */
    it('refuse en 400 un fieldName hors catalogue, avec la liste des noms acceptés', async () => {
      const promise = service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'motDePasse', audience: 'all' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/motDePasse/);
      await expect(promise).rejects.toThrow(/Accepted field names/);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 une tentative de régler firstName ou lastName — jamais réglables (arbitrage du 2026-08-17)', async () => {
      const promise = service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'firstName', audience: 'self' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(/firstName/);
      expect(repo.save).not.toHaveBeenCalled();

      const promiseLastName = service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'lastName', audience: 'all' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );
      await expect(promiseLastName).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 un champ du bloc pédagogique FORMATEUR pour un titulaire élève', async () => {
      const promise = service.updateFieldVisibility(
        OWNER_ID,
        { fields: [{ fieldName: 'levels', audience: 'self' }] },
        makeActor(UserRole.ELEVE, OWNER_ID),
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 dès qu’un seul champ du lot est inconnu — rien n’est écrit', async () => {
      await expect(
        service.updateFieldVisibility(
          OWNER_ID,
          {
            fields: [
              { fieldName: 'difficulties', audience: 'self' },
              { fieldName: 'champInexistant', audience: 'all' },
            ],
          },
          makeActor(UserRole.ELEVE, OWNER_ID),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuse en 400 un fieldName envoyé deux fois dans le même corps', async () => {
      await expect(
        service.updateFieldVisibility(
          OWNER_ID,
          {
            fields: [
              { fieldName: 'phone', audience: 'linked' },
              { fieldName: 'phone', audience: 'all' },
            ],
          },
          makeActor(UserRole.ELEVE, OWNER_ID),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('accepte les trois audiences self / linked / all', async () => {
      for (const audience of ['self', 'linked', 'all'] as const) {
        repo.save.mockClear();
        await service.updateFieldVisibility(
          OWNER_ID,
          { fields: [{ fieldName: 'goals', audience }] },
          makeActor(UserRole.ELEVE, OWNER_ID),
        );
        expect(repo.save.mock.calls[0][0][0].audience).toBe(audience);
      }
    });

    it('refuse en 403 un formateur qui modifie les réglages d’un élève', async () => {
      await expect(
        service.updateFieldVisibility(
          OWNER_ID,
          { fields: [{ fieldName: 'difficulties', audience: 'all' }] },
          makeActor(UserRole.FORMATEUR, 'teacher-uuid'),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('un TI peut modifier les réglages d’un autre utilisateur', async () => {
      await expect(
        service.updateFieldVisibility(
          OWNER_ID,
          { fields: [{ fieldName: 'difficulties', audience: 'self' }] },
          makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid'),
        ),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Port de résolution
  // ---------------------------------------------------------------------------
  describe('resolveAudience', () => {
    it('renvoie la dérogation quand elle existe', async () => {
      repo.findOne.mockResolvedValue({ audience: 'all' });
      await expect(service.resolveAudience(OWNER_ID, 'difficulties')).resolves.toBe('all');
    });

    it('renvoie le défaut commun `linked` en l’absence de dérogation', async () => {
      await expect(service.resolveAudience(OWNER_ID, 'difficulties')).resolves.toBe('linked');
    });

    it('renvoie self pour firstName/lastName — retirés du catalogue, jamais exposés', async () => {
      await expect(service.resolveAudience(OWNER_ID, 'firstName')).resolves.toBe('self');
      await expect(service.resolveAudience(OWNER_ID, 'lastName')).resolves.toBe('self');
    });

    it('renvoie self pour un champ inconnu — refus par défaut, jamais exposition', async () => {
      await expect(service.resolveAudience(OWNER_ID, 'champInexistant')).resolves.toBe('self');
    });
  });
});
