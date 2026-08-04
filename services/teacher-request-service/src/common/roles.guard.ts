import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './user-role.enum';
import { JwtPayload } from './jwt.guard';

/**
 * Declarative role gate. Reads the roles declared via @Roles() on the
 * handler (or controller) and compares them against the authenticated
 * actor's role. Routes without @Roles metadata are left untouched (no
 * static role restriction — the service handles resource-level access).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user || !requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('You do not have the required role for this action');
    }
    return true;
  }
}
