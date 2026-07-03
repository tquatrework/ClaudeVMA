/**
 * Utilitaires de formatage propres au dashboard
 *
 * Fonctions de normalisation des réponses API paginated/non-paginated.
 */

/**
 * Normalise une réponse API qui peut être soit un tableau direct,
 * soit un objet paginé { data: [...] }.
 */
export function normalizeListResponse<T>(
  response: T[] | { data?: T[] },
): T[] {
  if (Array.isArray(response)) return response
  return response.data ?? []
}

/**
 * Filtre et trie les événements futurs d'un calendrier.
 */
export function getFutureEvents<T extends { startAt: string }>(events: T[]): T[] {
  return events
    .filter((event) => new Date(event.startAt) >= new Date())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}
