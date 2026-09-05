import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Refus générique de rôle, EN FRANÇAIS (règle de langue du 2026-08-09 : les
 * clés d'API sont en anglais, tout ce que l'utilisateur lit est en français).
 * Le message anglais « Insufficient role » remontait jusqu'à l'écran — même
 * correctif et même libellé que `profile-service` (2026-09-05).
 */
export const FORBIDDEN_ROLE_MESSAGE =
  "Votre rôle ne vous permet pas d'accéder à cette ressource.";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(FORBIDDEN_ROLE_MESSAGE);
    }
    return true;
  }
}
