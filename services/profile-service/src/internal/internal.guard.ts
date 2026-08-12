import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protege les routes `/internal/*` par le secret partage `X-Internal-Secret`.
 *
 * Cette garde LAISSAIT PASSER quand `INTERNAL_SECRET` n'etait pas configure :
 * un simple `logger.warn` puis `return true`, donc toutes les routes internes
 * servies sans authentification. Une garde qui s'ouvre quand sa configuration
 * manque echoue dans le mauvais sens.
 *
 * Le passage en clair est supprime (2026-08-12). L'absence de secret est
 * desormais traitee en amont : `validateEnv` (src/config/env.validation.ts)
 * empeche le service de demarrer. `getOrThrow` ici est la seconde barriere —
 * si un chemin de bootstrap contournait la validation, la garde echoue en
 * refusant, jamais en ouvrant.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.getOrThrow<string>('INTERNAL_SECRET');
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    if (provided !== expected) {
      throw new UnauthorizedException('Internal access only');
    }
    return true;
  }
}
