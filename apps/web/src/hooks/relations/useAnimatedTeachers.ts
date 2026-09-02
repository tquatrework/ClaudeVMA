/**
 * useAnimatedTeachers — formateurs animés par un animateur pédagogique
 * (`GET /relations/animator-teacher/:animatorId`, `docs/routes.md` § profile-service
 * > Relations). Complément du 2026-09-02 (point 3, « Contacts essentiels » de
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP ») : la route
 * existait déjà et est déjà ouverte au RP/TI/AP lui-même, mais n'était consommée par
 * aucun composant front avant ce chantier.
 */

import { fetchAnimatedTeachers } from '../../api/relations'
import type { AnimatorTeacherRelation } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'

/** Ne se résout jamais : l'appel n'a pas lieu d'être, et rien ne doit s'afficher. */
function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

export interface UseAnimatedTeachersResult {
  relations: AnimatorTeacherRelation[]
  isLoading: boolean
  loadError: string | null
}

/**
 * @param animatorId Identifiant de l'animateur pédagogique consulté.
 * @param isEnabled `true` seulement quand l'appelant a structurellement une chance
 *   d'avoir ce droit (RP, TI, ou l'AP lui-même) — évite un appel réseau voué à
 *   l'échec. Le serveur reste seul juge du droit réel.
 */
export function useAnimatedTeachers(
  animatorId: string | undefined,
  isEnabled: boolean,
): UseAnimatedTeachersResult {
  const { data, isLoading, error } = useAsyncData(
    () =>
      isEnabled && animatorId
        ? fetchAnimatedTeachers(animatorId)
        : pendingForever<AnimatorTeacherRelation[]>(),
    [animatorId, isEnabled],
    { fallbackErrorMessage: 'Impossible de charger les formateurs animés.' },
  )

  return {
    relations: data ?? [],
    isLoading,
    loadError: error,
  }
}
