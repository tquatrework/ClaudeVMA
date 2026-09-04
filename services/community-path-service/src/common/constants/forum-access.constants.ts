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
 * Rôles dont un sujet créé est auto-validé, sans passer par
 * `pending_validation` — arbitrage du 2026-09-04 ("Structure en sujets
 * (topics) des Forums"), par cohérence avec le cycle de validation déjà
 * établi pour le contenu pédagogique (Quizz/Exercice/Évaluation/Tutoriel,
 * 2026-08-28 et suivants) où un créateur AP ou RP est son propre validateur.
 * Ce point n'est pas explicitement tranché mot pour mot par l'arbitrage
 * Forums lui-même — extension par cohérence, à corriger si l'intention était
 * que tout sujet, y compris ceux créés par un RP, passe systématiquement par
 * `pending_validation`.
 */
export const FORUM_TOPIC_AUTO_VALIDATE_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

/**
 * Seul le RP décide de la validation d'un sujet — arbitrage du 2026-09-04.
 * À la différence du contenu pédagogique générique, aucun scoping AP
 * (`animator_of_teacher`) n'est prévu ici : l'arbitrage ne mentionne que le
 * RP comme décideur.
 */
export const FORUM_TOPIC_DECISION_ROLES: string[] = [UserRole.RESPONSABLE_PEDAGOGIQUE];
