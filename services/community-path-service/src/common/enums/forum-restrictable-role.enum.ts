/**
 * Rôles pouvant être ciblés par la restriction d'accès d'un forum
 * (arbitrage du 2026-09-04, "Developpement reel des Forums").
 *
 * Les rôles administratifs (RP, AF, TI) ne figurent pas dans cette liste :
 * ils gardent un accès illimité à tout forum quel que soit son réglage
 * (voir FORUM_ADMIN_BYPASS_ROLES), les y ajouter à la restriction n'aurait
 * donc aucun effet.
 */
export enum ForumRestrictableRole {
  ELEVE = 'eleve',
  PARENT_FINANCEUR = 'parent_financeur',
  FORMATEUR = 'formateur',
  ANIMATEUR_PEDAGOGIQUE = 'animateur_pedagogique',
}
