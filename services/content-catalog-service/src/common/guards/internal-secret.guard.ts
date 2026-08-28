import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard protégeant les routes /internal/* réservées aux appels interservices,
 * sur le même modèle que les routes internes déjà en place ailleurs dans le
 * projet (ex. profile-service).
 *
 * Échoue fermé : si INTERNAL_SECRET n'est pas configuré, la route refuse tout
 * appel plutôt que de laisser passer — cf. docs/routes.md, bug historique où
 * une route interne laissait passer quand INTERNAL_SECRET était absent.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    const expected = this.config.get<string>('INTERNAL_SECRET');

    if (!expected) {
      throw new UnauthorizedException('INTERNAL_SECRET non configuré');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('En-tête X-Internal-Secret manquant ou invalide');
    }
    return true;
  }
}
