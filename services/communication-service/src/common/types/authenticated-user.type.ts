import { UserRole } from '../enums/user-role.enum';

/**
 * Actor extracted from a verified access-token JWT (identity-access-service).
 * This is the only typed shape controllers and services may rely on to know
 * "who is calling" — never `request.user: any` / `req.user`.
 */
export interface AuthenticatedUser {
  id: string;
  loginIdentifier: string;
  email: string;
  role: UserRole;
  validationStatus: string;
  jti: string;
}
