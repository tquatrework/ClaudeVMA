import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  MediaConfig,
  maxUploadBytesFromEnvironment,
  resolveMaxUploadBytes,
} from '../../../src/media/media.config';

/** Plafond par défaut de nginx sur le corps d'une requête, en octets. */
const NGINX_DEFAULT_CLIENT_MAX_BODY_SIZE = 1024 * 1024;

const configReturning = (values: Record<string, string | undefined>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('MediaConfig — plafond de téléversement', () => {
  const initialEnvironmentValue = process.env.MEDIA_MAX_UPLOAD_BYTES;

  afterEach(() => {
    if (initialEnvironmentValue === undefined) delete process.env.MEDIA_MAX_UPLOAD_BYTES;
    else process.env.MEDIA_MAX_UPLOAD_BYTES = initialEnvironmentValue;
    jest.restoreAllMocks();
  });

  describe('valeur par défaut', () => {
    it('vaut 1 000 000 octets, comme docker-compose.yml', () => {
      expect(DEFAULT_MAX_UPLOAD_BYTES).toBe(1_000_000);
    });

    /**
     * LE test qui compte. Le reverse-proxy ne déclare aucun
     * `client_max_body_size` : son défaut de 1 Mio s'applique au corps ENTIER,
     * enveloppe multipart comprise. Un plafond applicatif égal ou supérieur
     * laisserait une bande de tailles où le fichier passe le contrôle du
     * service mais où la requête est coupée par nginx, qui répond un 413 HTML
     * illisible par le front. La marge doit rester strictement positive.
     */
    it('reste STRICTEMENT sous le plafond de nginx, enveloppe multipart comprise', () => {
      expect(DEFAULT_MAX_UPLOAD_BYTES).toBeLessThan(NGINX_DEFAULT_CLIENT_MAX_BODY_SIZE);

      const marginBytes = NGINX_DEFAULT_CLIENT_MAX_BODY_SIZE - DEFAULT_MAX_UPLOAD_BYTES;
      // Une enveloppe multipart (frontières, en-têtes de partie, nom de champ)
      // pèse quelques centaines d'octets ; 16 Ko de marge la couvrent largement.
      expect(marginBytes).toBeGreaterThanOrEqual(16 * 1024);
    });

    it('s’applique quand la variable est absente ou vide', () => {
      expect(resolveMaxUploadBytes(undefined)).toBe(DEFAULT_MAX_UPLOAD_BYTES);
      expect(resolveMaxUploadBytes('')).toBe(DEFAULT_MAX_UPLOAD_BYTES);
      expect(resolveMaxUploadBytes('   ')).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    });
  });

  describe('lecture de MEDIA_MAX_UPLOAD_BYTES', () => {
    it('retient la valeur fournie', () => {
      expect(resolveMaxUploadBytes('2500000')).toBe(2_500_000);
    });

    it('tronque une valeur décimale plutôt que de garder des octets fractionnaires', () => {
      expect(resolveMaxUploadBytes('1000000.9')).toBe(1_000_000);
    });

    it.each([['8Mo'], ['huit'], ['-1'], ['0'], ['NaN']])(
      'refuse %s et retombe sur le défaut, sans désactiver le plafond',
      (rawValue) => {
        const logger = new Logger('test');
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

        expect(resolveMaxUploadBytes(rawValue, logger)).toBe(DEFAULT_MAX_UPLOAD_BYTES);
        expect(warn).toHaveBeenCalled();
      },
    );

    it('lit process.env pour le plafond appliqué par multer', () => {
      process.env.MEDIA_MAX_UPLOAD_BYTES = '1234567';
      expect(maxUploadBytesFromEnvironment()).toBe(1_234_567);

      delete process.env.MEDIA_MAX_UPLOAD_BYTES;
      expect(maxUploadBytesFromEnvironment()).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    });
  });

  describe('cohérence entre le plafond de multer et celui du service', () => {
    it('ne dit rien quand les deux lectures coïncident', () => {
      process.env.MEDIA_MAX_UPLOAD_BYTES = '900000';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const mediaConfig = new MediaConfig(
        configReturning({ MEDIA_MAX_UPLOAD_BYTES: '900000', MEDIA_STORAGE_PATH: '/tmp/media' }),
      );

      expect(mediaConfig.maxUploadBytes).toBe(900_000);
      expect(warn).not.toHaveBeenCalled();
    });

    /**
     * Cas réel : `MEDIA_MAX_UPLOAD_BYTES` défini dans un fichier `.env` mais
     * pas dans l'environnement du processus. `ConfigService` le voit, multer —
     * évalué à l'import du contrôleur, avant `ConfigModule` — ne le voit pas.
     * Le flux serait alors coupé à un seuil et refusé à un autre, et la limite
     * annoncée au front ne serait pas celle appliquée.
     */
    it('journalise un avertissement quand elles divergent', () => {
      process.env.MEDIA_MAX_UPLOAD_BYTES = '1000000';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const mediaConfig = new MediaConfig(
        configReturning({ MEDIA_MAX_UPLOAD_BYTES: '5000000', MEDIA_STORAGE_PATH: '/tmp/media' }),
      );

      expect(mediaConfig.maxUploadBytes).toBe(5_000_000);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('INCOHÉRENT'));
    });
  });
});
