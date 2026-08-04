import { UserRole, ValidationStatus } from '../../auth/entities/user.entity';

/** Projection publique d'un compte — ne contient jamais le hash de mot de passe. */
export interface AccountResponseDto {
  id: string;
  loginIdentifier: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  validationStatus: ValidationStatus;
  consentSigned: boolean;
  isActive: boolean;
  createdAt: Date;
  emailAlreadyUsed?: boolean;
  suggestedLoginIdentifier?: string;
}

/** Réponse de création d'un compte élève, avec compte parent optionnel lié ou créé. */
export interface StudentAccountCreationResponseDto {
  student: AccountResponseDto;
  parent: (AccountResponseDto & { created: boolean }) | null;
}

/** Réponse de GET /accounts/check-email. */
export interface CheckEmailResponseDto {
  alreadyUsed: boolean;
  suggestedLoginIdentifier: string;
}
