import { ValidationStatus } from '../../auth/entities/user.entity';
import { Actor } from './actor';

/**
 * Forme typée de l'acteur authentifié attachée à la requête par JwtStrategy.
 * Sur-ensemble de `Actor` (id + role) : peut toujours être passé à un service
 * qui n'exige que la forme minimale.
 * Ne contient jamais le hash de mot de passe (colonne `select: false`, jamais
 * chargée par le chemin d'authentification standard).
 */
export interface AuthenticatedUser extends Actor {
  loginIdentifier: string;
  email: string;
  validationStatus: ValidationStatus;
  consentSigned: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Identifiant unique du JWT courant — utilisé pour la révocation de session (logout). */
  jti: string;
}
