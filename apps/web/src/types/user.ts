/**
 * Types partagés — Utilisateur et rôles
 * Re-exporte UserRole depuis AuthContext pour éviter les imports croisés.
 */

export type { UserRole, AuthUser } from '../context/AuthContext'
