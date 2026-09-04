import { UserRole } from '../enums/user-role.enum';

/**
 * Rôles administratifs qui gardent un accès illimité à tout forum, quel que
 * soit son réglage de restriction par rôle — même principe que "les
 * administrateurs voient tout" posé ailleurs dans ce projet (RP, AF, TI).
 * Seul le RP peut créer un forum ou gérer sa charte, mais les trois rôles
 * contournent la restriction de lecture/participation.
 */
export const FORUM_ADMIN_BYPASS_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/**
 * Rôles autorisés à administrer la charte de bonne conduite (texte global).
 */
export const FORUM_CHARTER_MANAGER_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

/**
 * Seul le RP crée un forum désormais (arbitrage du 2026-09-04 — l'AP perd ce
 * droit, plus de mécanisme de publication/validation).
 */
export const FORUM_CREATOR_ROLES: string[] = [UserRole.RESPONSABLE_PEDAGOGIQUE];
