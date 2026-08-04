/**
 * Common, typed representation of the authenticated caller used across
 * every service-layer use case. Services must never receive a raw HTTP
 * request object or an untyped payload to identify who is acting.
 */
export interface Actor {
  id: string;
  role: string;
}
