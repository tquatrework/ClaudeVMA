import { UserRole, ValidationStatus } from '../entities/user.entity';

/** Réponse d'authentification — paire de tokens JWT et identité minimale. */
export interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    loginIdentifier: string;
    email: string;
    role: UserRole;
    validationStatus: ValidationStatus;
    emailVerified: boolean;
  };
}

/** Réponse de GET /auth/me. */
export interface CurrentUserResponseDto {
  id: string;
  loginIdentifier: string;
  email: string;
  role: UserRole;
  validationStatus: ValidationStatus;
  consentSigned: boolean;
}
