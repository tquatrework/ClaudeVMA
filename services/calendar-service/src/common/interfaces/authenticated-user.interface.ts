import { UserRole } from '../enums/user-role.enum';

/**
 * Canonical typed representation of the authenticated caller, attached to
 * `request.user` by `JwtAuthGuard` and exposed to controllers via
 * `@CurrentUser()`.
 *
 * Services also use this type (see services-convention: "Actor commun et
 * typé") instead of accepting loose `id`/`role` primitives or `any`.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly role: UserRole;
  readonly loginIdentifier?: string;
  readonly email?: string;
  readonly validationStatus?: string;
}
