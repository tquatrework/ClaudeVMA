import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InternalGuard } from '../../../src/internal/internal.guard';

/**
 * `InternalGuard` protege les routes `/internal/*` — dont
 * `GET /internal/profiles/:userId/display-name` et
 * `POST /internal/profiles/display-names`, qui servent une identite (prenom,
 * nom) sans lecteur et sans filtrage de visibilite.
 *
 * Le garde-fou central de cette suite : la garde ne doit JAMAIS laisser passer
 * quand `INTERNAL_SECRET` n'est pas configure. Elle le faisait jusqu'au
 * 2026-08-12, avec un simple avertissement dans les logs.
 */
describe('InternalGuard', () => {
  const CONFIGURED_SECRET = 'internal_secret_for_unit_tests';

  /** ExecutionContext minimal portant les entetes d'une requete HTTP. */
  function makeContext(headers: Record<string, string>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
  }

  /**
   * ConfigService reduit a `getOrThrow`, avec la meme semantique que le vrai :
   * il leve quand la variable est absente.
   */
  function makeConfigService(internalSecret?: string): ConfigService {
    return {
      getOrThrow: (key: string) => {
        if (key !== 'INTERNAL_SECRET') throw new Error(`Unexpected config key ${key}`);
        if (internalSecret === undefined) {
          throw new Error('Configuration key "INTERNAL_SECRET" does not exist');
        }
        return internalSecret;
      },
    } as unknown as ConfigService;
  }

  describe('secret configure', () => {
    const guard = new InternalGuard(makeConfigService(CONFIGURED_SECRET));

    it('laisse passer une requete portant le bon secret', () => {
      const context = makeContext({ 'x-internal-secret': CONFIGURED_SECRET });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('refuse une requete portant un mauvais secret', () => {
      const context = makeContext({ 'x-internal-secret': 'wrong_secret' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it("refuse une requete sans l'entete X-Internal-Secret", () => {
      expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
    });
  });

  describe('secret absent de la configuration', () => {
    it('refuse la requete au lieu de la laisser passer', () => {
      // Regression : la garde journalisait un avertissement puis renvoyait true,
      // ouvrant toutes les routes /internal/* a quiconque atteint le reseau
      // Docker. Le demarrage est desormais refuse en amont par validateEnv ;
      // cette assertion verrouille la seconde barriere.
      const guard = new InternalGuard(makeConfigService(undefined));

      expect(() => guard.canActivate(makeContext({}))).toThrow();
      expect(() =>
        guard.canActivate(makeContext({ 'x-internal-secret': CONFIGURED_SECRET })),
      ).toThrow();
    });

    it('refuse la requete quand le secret configure est une chaine vide', () => {
      // Cas impossible depuis validateEnv, verrouille par prudence : une chaine
      // vide ne doit jamais valoir « pas de controle ».
      const guard = new InternalGuard(makeConfigService(''));

      expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
      expect(() =>
        guard.canActivate(makeContext({ 'x-internal-secret': 'anything' })),
      ).toThrow(UnauthorizedException);
    });
  });
});
