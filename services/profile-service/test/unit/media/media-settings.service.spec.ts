import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { MediaSettingsService } from '../../../src/media/media-settings.service';
import { MediaConfig } from '../../../src/media/media.config';
import {
  MEDIA_SETTINGS_SINGLETON_ID,
  MediaSettings,
} from '../../../src/media/entities/media-settings.entity';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { Actor } from '../../../src/common/types/actor.type';

const TI_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const makeActor = (id = TI_ID): Actor => ({ id, role: UserRole.TECHNICIEN_INFORMATIQUE });

const makeSettings = (overrides: Partial<MediaSettings> = {}): MediaSettings =>
  ({
    id: MEDIA_SETTINGS_SINGLETON_ID,
    maxAvatarUploadBytes: 1_000_000,
    updatedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as MediaSettings;

/**
 * Plafond d'envoi de la photo de profil, réglable par le TI à l'exécution
 * (arbitrage du 2026-08-26). Le point le plus important couvert ici : la
 * ligne unique de `media_settings` est AMORCÉE à la première lecture, à
 * partir de la variable d'environnement (via `MediaConfig`) — jamais avant,
 * jamais autrement.
 */
describe('MediaSettingsService', () => {
  let service: MediaSettingsService;
  let repo: any;
  let mediaConfig: MediaConfig;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    mediaConfig = { maxUploadBytes: 1_000_000, storagePath: '/tmp/media' } as MediaConfig;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaSettingsService,
        { provide: getRepositoryToken(MediaSettings), useValue: repo },
        { provide: MediaConfig, useValue: mediaConfig },
      ],
    }).compile();

    service = module.get<MediaSettingsService>(MediaSettingsService);
  });

  // ===========================================================================
  // AMORÇAGE
  // ===========================================================================
  describe('amorçage à la première lecture', () => {
    it('crée la ligne à partir de MediaConfig.maxUploadBytes quand aucune ligne n’existe', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.getMaxAvatarUploadBytes();

      expect(result).toBe(1_000_000);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: MEDIA_SETTINGS_SINGLETON_ID,
          maxAvatarUploadBytes: 1_000_000,
          updatedBy: null,
        }),
      );
    });

    it('n’écrit RIEN quand une ligne existe déjà', async () => {
      repo.findOne.mockResolvedValue(makeSettings({ maxAvatarUploadBytes: 2_500_000 }));

      const result = await service.getMaxAvatarUploadBytes();

      expect(result).toBe(2_500_000);
      expect(repo.save).not.toHaveBeenCalled();
    });

    /**
     * Deux premières lectures simultanées peuvent tenter l'amorçage en même
     * temps. La contrainte de clé primaire fait échouer la seconde ; elle
     * doit relire la ligne créée par la première plutôt que de faire échouer
     * la requête de l'utilisateur.
     */
    it('relit la ligne créée par une autre requête concurrente plutôt que d’échouer', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // première lecture : rien
        .mockResolvedValueOnce(makeSettings({ maxAvatarUploadBytes: 1_000_000 })); // relecture après conflit
      repo.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT', [], new Error('duplicate key value violates unique constraint')),
      );

      const result = await service.getMaxAvatarUploadBytes();

      expect(result).toBe(1_000_000);
      expect(repo.findOne).toHaveBeenCalledTimes(2);
    });

    it('propage l’erreur si l’échec de sauvegarde n’est pas une collision (pas de ligne concurrente relue)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], new Error('connexion perdue')),
      );

      await expect(service.getMaxAvatarUploadBytes()).rejects.toThrow(QueryFailedError);
    });
  });

  // ===========================================================================
  // LECTURE
  // ===========================================================================
  describe('getMaxAvatarUploadBytes', () => {
    it('renvoie la valeur en base, pas celle de MediaConfig, une fois la ligne amorcée', async () => {
      repo.findOne.mockResolvedValue(makeSettings({ maxAvatarUploadBytes: 5_000_000 }));

      const result = await service.getMaxAvatarUploadBytes();

      expect(result).toBe(5_000_000);
      expect(result).not.toBe(mediaConfig.maxUploadBytes);
    });
  });

  // ===========================================================================
  // ÉCRITURE
  // ===========================================================================
  describe('updateMaxAvatarUploadBytes', () => {
    it('remplace la valeur et trace l’auteur du changement', async () => {
      repo.findOne.mockResolvedValue(makeSettings({ maxAvatarUploadBytes: 1_000_000 }));

      const result = await service.updateMaxAvatarUploadBytes(3_000_000, makeActor());

      expect(result.maxAvatarUploadBytes).toBe(3_000_000);
      expect(result.updatedBy).toBe(TI_ID);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ maxAvatarUploadBytes: 3_000_000, updatedBy: TI_ID }),
      );
    });

    it('amorce la ligne si nécessaire avant de la mettre à jour', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.updateMaxAvatarUploadBytes(3_000_000, makeActor());

      // Premier save : amorçage à la valeur de MediaConfig. Second save :
      // écrasement par la nouvelle valeur réglée.
      expect(repo.save).toHaveBeenCalledTimes(2);
      const [, secondCallArgs] = repo.save.mock.calls;
      expect(secondCallArgs[0]).toEqual(
        expect.objectContaining({ maxAvatarUploadBytes: 3_000_000 }),
      );
    });

    /**
     * Une valeur immédiatement relue après écriture doit être CELLE QUI VIENT
     * D'ÊTRE POSÉE : la route qui appelle ce service (`PATCH
     * /profiles/avatar/settings`) doit répondre la valeur réellement
     * enregistrée, jamais la valeur envoyée telle quelle si elle n'a pas été
     * confirmée par le serveur (règle du 2026-08-10, point 3bis).
     */
    it('la valeur posée est immédiatement relisible par getMaxAvatarUploadBytes', async () => {
      const stored = makeSettings({ maxAvatarUploadBytes: 1_000_000 });
      repo.findOne.mockResolvedValue(stored);
      repo.save.mockImplementation(async (entity: MediaSettings) => {
        Object.assign(stored, entity);
        return stored;
      });

      await service.updateMaxAvatarUploadBytes(4_200_000, makeActor());
      const reread = await service.getMaxAvatarUploadBytes();

      expect(reread).toBe(4_200_000);
    });
  });
});
