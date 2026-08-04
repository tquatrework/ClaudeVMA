import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Declares the set of roles allowed to call a route. Enforced by RolesGuard.
 * Resource-level authorization (ownership, ...) still belongs to the service.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
