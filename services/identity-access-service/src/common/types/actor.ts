import { UserRole } from '../../auth/entities/user.entity';

/**
 * Forme minimale d'un acteur métier, indépendante du transport HTTP/JWT.
 * Les services n'exigent jamais plus que ce dont ils ont besoin (id + role) :
 * `AuthenticatedUser` (couche contrôleur) est un sur-ensemble structurellement
 * compatible et peut toujours être passé là où un `Actor` est attendu.
 */
export interface Actor {
  id: string;
  role: UserRole;
}
