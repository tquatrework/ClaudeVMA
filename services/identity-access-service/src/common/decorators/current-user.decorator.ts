import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Extrait l'acteur authentifié (posé par JwtStrategy) depuis la requête HTTP.
 * Seul point d'accès autorisé à l'acteur dans les contrôleurs (controllers-convention) :
 * `@Req()` / `@Request()` non typé et `req.user: any` sont interdits.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
