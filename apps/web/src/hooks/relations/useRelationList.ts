/**
 * useRelationList — chargement générique d'une liste de relations gardées par un
 * identifiant unique (formateurs animés par un AP, élèves d'un formateur, AP d'un
 * formateur…). Factorisée le 2026-09-02 pour ne pas dupliquer la même mécanique
 * (chargement conditionnel, `pendingForever` quand désactivé) à chaque nouvelle
 * relation câblée sur `ProfilePage` — voir `useAnimatedTeachers`,
 * `useStudentsOfTeacher`, `useAnimatorsOfTeacher`.
 */

import { useAsyncData } from '../useAsyncData'

/** Ne se résout jamais : l'appel n'a pas lieu d'être, et rien ne doit s'afficher. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

export interface UseRelationListResult<T> {
  relations: T[]
  isLoading: boolean
  loadError: string | null
}

/**
 * @param fetchFn Fonction `api/*` retournant la liste pour un identifiant donné.
 * @param id Identifiant de la personne consultée (formateur, animateur, …).
 * @param isEnabled `true` seulement quand l'appelant a structurellement une chance
 *   d'avoir ce droit — évite un appel réseau voué à l'échec. Le serveur reste seul
 *   juge du droit réel.
 * @param fallbackErrorMessage Message de secours propre à la relation chargée.
 */
export function useRelationList<T>(
  fetchFn: (id: string) => Promise<T[]>,
  id: string | undefined,
  isEnabled: boolean,
  fallbackErrorMessage: string,
): UseRelationListResult<T> {
  const { data, isLoading, error } = useAsyncData(
    () => (isEnabled && id ? fetchFn(id) : pendingForever<T[]>()),
    [id, isEnabled],
    { fallbackErrorMessage },
  )

  return {
    relations: data ?? [],
    isLoading,
    loadError: error,
  }
}
