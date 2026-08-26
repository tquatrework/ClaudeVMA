import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { MediaSettingsController } from '../../../src/media/media-settings.controller';
import { MediaSettingsService } from '../../../src/media/media-settings.service';

const TI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * `PATCH /profiles/avatar/settings` — écriture réservée au TI, cas nominaux
 * et cas d'erreur.
 *
 * Une vraie application Nest (guards réels sauf JwtAuthGuard/RolesGuard, dont
 * le comportement générique est déjà couvert par roles.guard.spec.ts) pour
 * exercer le VRAI ValidationPipe global — c'est lui qui doit produire le
 * `400` sur une valeur hors bornes, pas un contrôle manuel dans le service.
 */
describe('MediaSettingsController — PATCH /profiles/avatar/settings', () => {
  let app: INestApplication;
  let mediaSettingsService: { updateMaxAvatarUploadBytes: jest.Mock };
  let currentRole: UserRole;

  const roleAwareGuard = {
    canActivate: (context: any) => {
      context.switchToHttp().getRequest().user = { id: TI_ID, role: currentRole };
      return true;
    },
  };

  beforeAll(async () => {
    mediaSettingsService = {
      updateMaxAvatarUploadBytes: jest.fn().mockImplementation(async (maxAvatarUploadBytes: number) => ({
        maxAvatarUploadBytes,
        updatedAt: new Date('2026-08-26T10:00:00.000Z'),
      })),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MediaSettingsController],
      providers: [{ provide: MediaSettingsService, useValue: mediaSettingsService }, RolesGuard],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(roleAwareGuard)
      .compile();

    app = moduleRef.createNestApplication();
    // RolesGuard n'est PAS remplacé : seul JwtAuthGuard est simulé pour
    // injecter l'acteur. RolesGuard reste donc le vrai code qui lit le rôle
    // posé ci-dessus — c'est lui qui doit produire le 403.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    mediaSettingsService.updateMaxAvatarUploadBytes.mockClear();
    currentRole = UserRole.TECHNICIEN_INFORMATIQUE;
  });

  describe('cas nominal', () => {
    it('répond 200 avec la valeur mise à jour, relue depuis le service', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: 2_000_000 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        maxAvatarUploadBytes: 2_000_000,
        updatedAt: '2026-08-26T10:00:00.000Z',
      });
      expect(mediaSettingsService.updateMaxAvatarUploadBytes).toHaveBeenCalledWith(
        2_000_000,
        expect.objectContaining({ id: TI_ID, role: UserRole.TECHNICIEN_INFORMATIQUE }),
      );
    });
  });

  describe('rôle non autorisé', () => {
    it.each([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.ELEVE,
      UserRole.FORMATEUR,
      UserRole.PARENT_FINANCEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
    ])('refuse en 403 pour %s', async (role) => {
      currentRole = role;

      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: 2_000_000 });

      expect(response.status).toBe(403);
      expect(mediaSettingsService.updateMaxAvatarUploadBytes).not.toHaveBeenCalled();
    });
  });

  describe('valeur invalide', () => {
    it.each([
      ['zéro', 0],
      ['négative', -1_000],
      ['non entière', 1_500_000.5],
    ])('refuse en 400 une valeur %s', async (_label, value) => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: value });

      expect(response.status).toBe(400);
      expect(mediaSettingsService.updateMaxAvatarUploadBytes).not.toHaveBeenCalled();
    });

    it('refuse en 400 une valeur trop basse (moins de quelques Ko)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: 100 });

      expect(response.status).toBe(400);
    });

    it('refuse en 400 une valeur absurdement haute', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: 999_000_000_000 });

      expect(response.status).toBe(400);
    });

    it('refuse en 400 un champ inconnu (forbidNonWhitelisted)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({ maxAvatarUploadBytes: 2_000_000, maxUploadBytes: 2_000_000 });

      expect(response.status).toBe(400);
    });

    it('refuse en 400 un corps vide', async () => {
      const response = await request(app.getHttpServer())
        .patch('/profiles/avatar/settings')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
