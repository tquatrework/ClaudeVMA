// class-transformer/class-validator lisent les metadonnees des decorateurs :
// sans ce polyfill, `plainToInstance` echoue sur `Reflect.getMetadata`. En
// production il est charge par le bootstrap Nest, jamais par ce module.
import 'reflect-metadata';

import { validateEnv } from '../../../src/config/env.validation';

/**
 * Le service doit REFUSER DE DEMARRER si `INTERNAL_SECRET` est absent ou vide.
 *
 * Avant le 2026-08-12, `InternalGuard` journalisait un avertissement puis
 * laissait passer : toutes les routes `/internal/*` etaient alors servies sans
 * authentification, y compris celles qui renvoient une identite (prenom, nom)
 * sans lecteur ni filtrage de visibilite. Une garde qui s'ouvre quand sa
 * configuration manque echoue dans le mauvais sens.
 */
describe('validateEnv', () => {
  /** Environnement minimal valide, duquel chaque cas retire ce qu'il teste. */
  const validEnvironment = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://visiomath:secret@localhost:5432/profile_test',
    JWT_SECRET: 'jwt_secret_for_unit_tests',
    INTERNAL_SECRET: 'internal_secret_for_unit_tests',
  };

  describe('INTERNAL_SECRET', () => {
    it('accepte un environnement complet et renvoie la valeur du secret', () => {
      const validatedConfig = validateEnv(validEnvironment);

      expect(validatedConfig.INTERNAL_SECRET).toBe('internal_secret_for_unit_tests');
    });

    it('refuse le demarrage quand INTERNAL_SECRET est absent', () => {
      const { INTERNAL_SECRET, ...environmentWithoutSecret } = validEnvironment;

      expect(() => validateEnv(environmentWithoutSecret)).toThrow(
        /Invalid environment configuration[\s\S]*INTERNAL_SECRET/,
      );
    });

    it('refuse le demarrage quand INTERNAL_SECRET est une chaine vide', () => {
      expect(() => validateEnv({ ...validEnvironment, INTERNAL_SECRET: '' })).toThrow(
        /Invalid environment configuration[\s\S]*INTERNAL_SECRET/,
      );
    });

  });

  describe('autres variables requises', () => {
    it('refuse le demarrage quand DATABASE_URL est absente', () => {
      const { DATABASE_URL, ...environmentWithoutDatabase } = validEnvironment;

      expect(() => validateEnv(environmentWithoutDatabase)).toThrow(
        /Invalid environment configuration[\s\S]*DATABASE_URL/,
      );
    });

    it('refuse le demarrage quand JWT_SECRET est vide', () => {
      expect(() => validateEnv({ ...validEnvironment, JWT_SECRET: '' })).toThrow(
        /Invalid environment configuration[\s\S]*JWT_SECRET/,
      );
    });
  });

  describe('variables optionnelles', () => {
    it('accepte un environnement sans NODE_ENV', () => {
      const { NODE_ENV, ...environmentWithoutNodeEnv } = validEnvironment;

      expect(() => validateEnv(environmentWithoutNodeEnv)).not.toThrow();
    });

    it('refuse un NODE_ENV inconnu', () => {
      expect(() => validateEnv({ ...validEnvironment, NODE_ENV: 'staging' })).toThrow(
        /Invalid environment configuration[\s\S]*NODE_ENV/,
      );
    });

    it('laisse passer les variables non declarees, sans les perdre', () => {
      // MEDIA_STORAGE_PATH, MEDIA_MAX_UPLOAD_BYTES, IDENTITY_ACCESS_SERVICE_URL...
      // ne sont pas requises au demarrage, mais elles doivent rester lisibles.
      const validatedConfig = validateEnv({
        ...validEnvironment,
        MEDIA_MAX_UPLOAD_BYTES: '1000000',
      }) as unknown as Record<string, unknown>;

      expect(validatedConfig.MEDIA_MAX_UPLOAD_BYTES).toBe('1000000');
    });
  });
});
