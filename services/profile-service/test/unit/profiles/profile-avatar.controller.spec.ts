import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES } from '../../../src/media/entities/media-settings.entity';
import { AvatarService } from '../../../src/profiles/avatar.service';
import { ProfileAvatarController } from '../../../src/profiles/profile-avatar.controller';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Ce que les tests de `AvatarService` NE PEUVENT PAS montrer : ce qui se passe
 * avant lui.
 *
 * Le contrôleur pose sur multer un FILET DE SÉCURITÉ STATIQUE
 * (`MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES`), distinct depuis le 2026-08-26 du
 * plafond RÉGLABLE par le TI, vérifié dynamiquement dans le service (couvert
 * par `avatar.service.spec.ts`, où `AvatarService` est réel). Ici,
 * `AvatarService` est entièrement simulé : ce test n'exerce QUE la pile HTTP
 * — multer et le filtre d'erreur — jamais la logique de plafond dynamique.
 *
 * Deux points qui comptent réellement ici :
 *  1. un fichier dépassant le filet de sécurité est COUPÉ en streaming — le
 *     contrôleur n'est pas atteint, les octets excédentaires ne sont pas
 *     chargés en mémoire ;
 *  2. le corps du `413` produit dans ce cas est celui du contrat, et non le
 *     `{"message":"File too large"}` nu de multer.
 *
 * D'où une vraie application Nest, un vrai envoi multipart, un vrai multer.
 * Seuls les gardes et le service métier sont remplacés.
 */
describe('ProfileAvatarController — plafond de taille dans la pile HTTP', () => {
  let app: INestApplication;
  let avatarService: {
    uploadAvatar: jest.Mock;
    getUploadConstraints: jest.Mock;
  };

  /**
   * Plafond RÉELLEMENT appliqué par multer — le filet de sécurité fixe, PAS
   * la valeur dynamique réglable par le TI (celle-ci est simulée ci-dessous
   * via `getUploadConstraints`, volontairement différente pour bien marquer
   * que ce sont deux plafonds distincts).
   */
  const multerCeiling = MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES;

  /** Valeur DYNAMIQUE simulée, telle que `GET /profiles/avatar/constraints` l'annoncerait. */
  const dynamicMaxUploadBytes = 1_000_000;

  const allowAll = { canActivate: (context: any) => {
    context.switchToHttp().getRequest().user = { id: STUDENT_ID, role: 'eleve' };
    return true;
  } };

  beforeAll(async () => {
    avatarService = {
      uploadAvatar: jest.fn().mockResolvedValue({
        avatarUrl: `/api/v1/profiles/${STUDENT_ID}/avatar?v=1`,
      }),
      getUploadConstraints: jest.fn().mockResolvedValue({
        maxUploadBytes: dynamicMaxUploadBytes,
        acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
        outputContentType: 'image/webp',
        maxDimensionPixels: 512,
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProfileAvatarController],
      providers: [{ provide: AvatarService, useValue: avatarService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAll)
      .overrideGuard(RolesGuard)
      .useValue(allowAll)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    avatarService.uploadAvatar.mockClear();
  });

  describe('sous le filet de sécurité de multer', () => {
    it('transmet le fichier au service et répond 200, même au-delà du plafond DYNAMIQUE simulé', async () => {
      // Volontairement plus gros que `dynamicMaxUploadBytes` : ce test prouve
      // que le contrôleur (donc multer) ne connaît PAS cette valeur — seul le
      // service, mocké ici, la connaîtrait et la ferait respecter en réalité.
      const underMulterCeiling = Buffer.alloc(dynamicMaxUploadBytes + 64 * 1024, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', underMulterCeiling, { filename: 'photo.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ avatarUrl: `/api/v1/profiles/${STUDENT_ID}/avatar?v=1` });

      // Les octets sont bien arrivés entiers jusqu'au service.
      const [, receivedFile] = avatarService.uploadAvatar.mock.calls[0];
      expect(receivedFile.buffer.length).toBe(underMulterCeiling.length);
    });
  });

  describe('au-dessus du filet de sécurité de multer', () => {
    it('répond 413 et n’appelle JAMAIS le service — le flux est coupé avant', async () => {
      const overMulterCeiling = Buffer.alloc(multerCeiling + 64 * 1024, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', overMulterCeiling, { filename: 'trop-lourde.png', contentType: 'image/png' });

      expect(response.status).toBe(413);
      expect(avatarService.uploadAvatar).not.toHaveBeenCalled();
    }, 20_000);

    it('renvoie le corps du contrat, pas le « File too large » nu de multer', async () => {
      const overMulterCeiling = Buffer.alloc(multerCeiling + 64 * 1024, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', overMulterCeiling, { filename: 'trop-lourde.png', contentType: 'image/png' });

      expect(response.body).toMatchObject({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        // C'est le filet de sécurité fixe qui a coupé le flux, donc SA valeur
        // qui est annoncée — pas le plafond dynamique simulé plus haut.
        maxUploadBytes: multerCeiling,
        // Flux coupé : la taille du fichier n'a jamais été connue en entier.
        receivedBytes: null,
      });
      // Le Content-Length du corps multipart, lui, est déclaré par le client.
      expect(response.body.requestBodyBytes).toBeGreaterThan(multerCeiling);
      expect(response.body.message).not.toBe('File too large');
    }, 20_000);
  });

  describe('contraintes publiées', () => {
    it('sert GET /profiles/avatar/constraints sans le confondre avec un userId', async () => {
      const response = await request(app.getHttpServer()).get('/profiles/avatar/constraints');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        maxUploadBytes: dynamicMaxUploadBytes,
        acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
        outputContentType: 'image/webp',
        maxDimensionPixels: 512,
      });
    });

    /**
     * Depuis le 2026-08-26, ce N'EST PLUS le même plafond : `constraints`
     * annonce la valeur DYNAMIQUE (réglable par le TI), le refus déclenché
     * par multer annonce le filet de sécurité FIXE. Les confondre serait
     * précisément le défaut que la séparation en deux verrous cherche à
     * éviter (voir le commentaire de `ProfileAvatarController.uploadAvatar`).
     */
    it('le refus déclenché par multer annonce un plafond DIFFÉRENT de celui des contraintes publiées', async () => {
      const constraints = await request(app.getHttpServer()).get('/profiles/avatar/constraints');
      const refusal = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', Buffer.alloc(multerCeiling + 64 * 1024, 0x41), {
          filename: 'trop-lourde.png',
          contentType: 'image/png',
        });

      expect(refusal.body.maxUploadBytes).not.toBe(constraints.body.maxUploadBytes);
      expect(refusal.body.maxUploadBytes).toBe(multerCeiling);
      expect(constraints.body.maxUploadBytes).toBe(dynamicMaxUploadBytes);
    }, 20_000);
  });
});
