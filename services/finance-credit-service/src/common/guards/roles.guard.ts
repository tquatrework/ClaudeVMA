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

    // Ownership-scoped route: the service layer owns the decision, because it is the
    // only layer that knows who owns the resource. The guard only requires an
    // authenticated caller and must NOT filter on role — doing so would deny an owner
    // access to their own data as soon as a role is missing from the list.
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

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
