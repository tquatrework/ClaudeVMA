import { UserRole } from '../../auth/entities/user.entity';

/** Réponse minimale de POST /internal/create-account (usage interservices uniquement). */
export interface CreateAccountInternalResponseDto {
  accountId: string;
  loginIdentifier: string;
  email: string;
  role: UserRole;
}
