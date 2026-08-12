/**
 * Enveloppe de pagination commune aux listes bornées du projet.
 *
 * Plusieurs services la renvoient à l'identique — `archive-document-service`
 * (`GET /archives/students/:id/pedagogical-archives`) et, depuis le 2026-08-12,
 * `profile-service` (`GET /profiles/teachers/validated`). Une liste paginée est
 * **une enveloppe, jamais un tableau nu** : lire la racine comme un tableau
 * transforme une réponse valide en « aucun résultat », défaut relevé le
 * 2026-08-11 sur les archives.
 */
export interface PaginatedResponse<T> {
  data: T[]
  /** Page effectivement renvoyée (1-indexée). */
  page: number
  /** Taille de page appliquée par le serveur. */
  limit: number
  /** Nombre total d'éléments, toutes pages confondues. */
  total: number
  /** Nombre total de pages — `0` sur une liste vide. */
  totalPages: number
}
