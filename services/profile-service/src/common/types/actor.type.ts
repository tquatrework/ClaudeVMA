import { UserRole } from '../enums/user-role.enum';

/**
 * Minimal typed actor consumed by service-layer use cases (authorization
 * checks). AuthenticatedUser (the full request.user shape extracted by
 * @CurrentUser()) structurally satisfies this type, so controllers can pass
 * it directly to service methods without any mapping.
 *
 * This is the single shared "Actor" definition referenced by
 * services-convention ("utiliser un type Actor commun et typé"): no service
 * declares its own local Actor interface, and no service imports it from
 * another feature's service file.
 */
export interface Actor {
  id: string;
  role: UserRole;
}
