/**
 * Tri des entrées du cahier de texte — réplique côté front la règle appliquée
 * par le serveur (`docs/routes.md` § pedagogical-log-service, « Tri et
 * filtrage ») : `date` décroissante, entrées sans `date` en dernier, puis
 * `createdAt` décroissant à égalité.
 *
 * `GET /students/:studentId/pedagogical-log` renvoie déjà la liste triée : on ne
 * la re-trie donc jamais après lecture (règle explicite du 2026-08-20 — un
 * re-tri par erreur inverserait l'ordre). Cette fonction sert uniquement à
 * repositionner localement une entrée créée ou modifiée sans redemander la
 * liste au serveur (règle de chargement du 2026-08-10 : la réponse d'écriture
 * remonte à l'état de la page, pas une nouvelle requête) — appliquée à une
 * liste déjà triée selon cette même règle, elle est idempotente (tri stable).
 */

import type { PedagogicalLogPage } from '../api/pedagogicalLog'

export function sortPedagogicalLogEntries(
  entries: readonly PedagogicalLogPage[],
): PedagogicalLogPage[] {
  return [...entries].sort((entryA, entryB) => {
    if (entryA.date && entryB.date) {
      if (entryA.date !== entryB.date) return entryA.date > entryB.date ? -1 : 1
    } else if (entryA.date && !entryB.date) {
      return -1
    } else if (!entryA.date && entryB.date) {
      return 1
    }

    return new Date(entryB.createdAt).getTime() - new Date(entryA.createdAt).getTime()
  })
}
