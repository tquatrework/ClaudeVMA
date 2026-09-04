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

/**
 * Aucun rôle n'est auto-validé à la création d'un sujet — révisé le
 * 2026-09-04 (le jour même du chantier initial) : une première version avait
 * introduit une auto-validation RP/AP par cohérence avec le cycle de
 * validation du contenu pédagogique, mais l'arbitrage "Structure en sujets
 * (topics) des Forums" ne prévoit explicitement aucune exception de rôle —
 * "n'importe quel membre du forum peut créer un sujet" et "un sujet doit
 * être validé par un RP", sans distinction. Seul le sujet système "Sujet
 * général" (`ForumsService.createDefaultTopic`) échappe au flux de
 * validation, car il n'est pas créé par un membre.
 */

/**
 * Seul le RP décide de la validation d'un sujet — arbitrage du 2026-09-04.
 * À la différence du contenu pédagogique générique, aucun scoping AP
 * (`animator_of_teacher`) n'est prévu ici : l'arbitrage ne mentionne que le
 * RP comme décideur.
 */
export const FORUM_TOPIC_DECISION_ROLES: string[] = [UserRole.RESPONSABLE_PEDAGOGIQUE];
