import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OWNER_ACCESS_KEY } from '../decorators/owner-access.decorator';

/**
 * Refus générique de rôle, EN FRANÇAIS (règle de langue du 2026-08-09 : les
 * clés d'API sont en anglais, tout ce que l'utilisateur lit est en français).
 * Le message anglais « Insufficient role » remontait jusqu'à l'écran.
 *
 * Volontairement VAGUE sur ce qui est refusé : ce guard ne connaît pas la
 * ressource, et un message précis révélerait ce que l'appelant n'a pas le droit
 * de voir. Les services qui peuvent être précis le sont — voir les refus
 * détaillés de la validation des formateurs.
 */
export const FORBIDDEN_ROLE_MESSAGE =
  "Votre rôle ne vous permet pas d'accéder à cette ressource.";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    /**
     * Route pilotée par la relation ou la propriété : la décision appartient au
     * service, seul à connaître la ressource et les liens. Le guard exige un
     * appelant authentifié et ne filtre SURTOUT pas sur le rôle — le faire
     * refuserait à un titulaire l'accès à ses propres données dès qu'un rôle
     * manque dans la liste (voir owner-access.decorator.ts).
     */
    const isOwnerAccessRoute = this.reflector.getAllAndOverride<boolean>(OWNER_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isOwnerAccessRoute) {
      if (!user) {
        throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
      }
      return true;
    }

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
    }
    return true;
  }
}
