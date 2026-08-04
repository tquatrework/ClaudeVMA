import { UserRole } from '../enums/user-role.enum';

/**
 * Typed shape of the actor attached to the request by JwtAuthGuard
 * (request.user). Controllers must never read req.user directly or type it
 * as `any` — they extract it with the @CurrentUser() decorator instead
 * (controllers-convention).
 */
export interface AuthenticatedUser {
  id: string;
  loginIdentifier: string;
  email: string;
  role: UserRole;
  validationStatus: string;
  jti: string;
}
