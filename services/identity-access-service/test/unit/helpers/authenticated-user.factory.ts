import { UserRole, ValidationStatus } from '../../../src/auth/entities/user.entity';
import { AuthenticatedUser } from '../../../src/common/types/authenticated-user';

/**
 * Construit un acteur authentifié complet pour les tests de contrôleurs.
 * Les décorateurs `@CurrentUser()` ne s'exécutent pas quand on appelle une
 * méthode de contrôleur directement en test unitaire : on passe donc
 * l'acteur typé tel qu'il serait extrait de la requête HTTP réelle.
 */
export const makeAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'user-uuid',
  loginIdentifier: 'test.user',
  email: 'test@example.com',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  firstName: null,
  lastName: null,
  phone: null,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  jti: 'jti-uuid',
  ...overrides,
});
