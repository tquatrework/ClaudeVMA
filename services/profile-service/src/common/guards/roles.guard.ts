import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OWNER_ACCESS_KEY } from '../decorators/owner-access.decorator';

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
        throw new ForbiddenException('Insufficient role');
      }
      return true;
    }

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
