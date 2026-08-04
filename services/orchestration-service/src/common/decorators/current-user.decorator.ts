import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Extrait l'acteur authentifié posé par JwtAuthGuard sur la requête.
 * Remplace tout usage de @Req()/@Request() pour récupérer l'utilisateur
 * courant dans les contrôleurs.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
