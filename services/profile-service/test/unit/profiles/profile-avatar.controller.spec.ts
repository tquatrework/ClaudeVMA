import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { maxUploadBytesFromEnvironment } from '../../../src/media/media.config';
import { AvatarService } from '../../../src/profiles/avatar.service';
import { ProfileAvatarController } from '../../../src/profiles/profile-avatar.controller';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Ce que les tests de `AvatarService` NE PEUVENT PAS montrer : ce qui se passe
 * avant lui.
 *
 * Le plafond de taille est posé sur multer, donc dans la pile HTTP, et le
 * service n'est jamais appelé quand il se déclenche. Un test qui n'exercerait
 * que le service laisserait sans preuve les deux points qui comptent
 * réellement ici :
 *
 *  1. le flux est COUPÉ en streaming — le contrôleur n'est pas atteint, donc
 *     les octets excédentaires ne sont pas chargés en mémoire ;
 *  2. le corps du `413` est celui du contrat, et non le `{"message":"File too
 *     large"}` nu de multer.
 *
 * D'où une vraie application Nest, un vrai envoi multipart, un vrai multer.
 * Seuls les gardes et le service métier sont remplacés : ce sont eux, et eux
 * seuls, qui sont couverts ailleurs.
 */
describe('ProfileAvatarController — plafond de taille dans la pile HTTP', () => {
  let app: INestApplication;
  let avatarService: {
    uploadAvatar: jest.Mock;
    getUploadConstraints: jest.Mock;
  };

  /** Plafond réellement appliqué par multer, lu à la même source que lui. */
  const maxUploadBytes = maxUploadBytesFromEnvironment();

  const allowAll = { canActivate: (context: any) => {
    context.switchToHttp().getRequest().user = { id: STUDENT_ID, role: 'eleve' };
    return true;
  } };

  beforeAll(async () => {
    avatarService = {
      uploadAvatar: jest.fn().mockResolvedValue({
        avatarUrl: `/api/v1/profiles/${STUDENT_ID}/avatar?v=1`,
      }),
      getUploadConstraints: jest.fn().mockReturnValue({
        maxUploadBytes,
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

  describe('sous la limite', () => {
    it('transmet le fichier au service et répond 200', async () => {
      const underLimit = Buffer.alloc(maxUploadBytes - 4_096, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', underLimit, { filename: 'photo.png', contentType: 'image/png' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ avatarUrl: `/api/v1/profiles/${STUDENT_ID}/avatar?v=1` });

      // Les octets sont bien arrivés entiers jusqu'au service.
      const [, receivedFile] = avatarService.uploadAvatar.mock.calls[0];
      expect(receivedFile.buffer.length).toBe(underLimit.length);
    });
  });

  describe('au-dessus de la limite', () => {
    it('répond 413 et n’appelle JAMAIS le service — le flux est coupé avant', async () => {
      const overLimit = Buffer.alloc(maxUploadBytes + 64 * 1024, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', overLimit, { filename: 'trop-lourde.png', contentType: 'image/png' });

      expect(response.status).toBe(413);
      expect(avatarService.uploadAvatar).not.toHaveBeenCalled();
    });

    it('renvoie le corps du contrat, pas le « File too large » nu de multer', async () => {
      const overLimit = Buffer.alloc(maxUploadBytes + 64 * 1024, 0x41);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', overLimit, { filename: 'trop-lourde.png', contentType: 'image/png' });

      expect(response.body).toMatchObject({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        maxUploadBytes,
        // Flux coupé : la taille du fichier n'a jamais été connue en entier.
        receivedBytes: null,
      });
      // Le Content-Length du corps multipart, lui, est déclaré par le client.
      expect(response.body.requestBodyBytes).toBeGreaterThan(maxUploadBytes);
      expect(response.body.message).not.toBe('File too large');
    });
  });

  describe('contraintes publiées', () => {
    it('sert GET /profiles/avatar/constraints sans le confondre avec un userId', async () => {
      const response = await request(app.getHttpServer()).get('/profiles/avatar/constraints');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        maxUploadBytes,
        acceptedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
        outputContentType: 'image/webp',
        maxDimensionPixels: 512,
      });
    });

    /**
     * La limite annoncée doit être CELLE QUE MULTER APPLIQUE. Si les deux
     * divergeaient, le front pré-validerait sur une valeur fausse et
     * l'utilisateur se ferait refuser une image qu'on venait de lui annoncer
     * acceptable.
     */
    it('annonce exactement le plafond appliqué par le refus', async () => {
      const constraints = await request(app.getHttpServer()).get('/profiles/avatar/constraints');
      const refusal = await request(app.getHttpServer())
        .post(`/profiles/${STUDENT_ID}/avatar`)
        .attach('file', Buffer.alloc(maxUploadBytes + 64 * 1024, 0x41), {
          filename: 'trop-lourde.png',
          contentType: 'image/png',
        });

      expect(refusal.body.maxUploadBytes).toBe(constraints.body.maxUploadBytes);
    });
  });
});
