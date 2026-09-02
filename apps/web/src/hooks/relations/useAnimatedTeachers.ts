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
import { useRelationList, type UseRelationListResult } from './useRelationList'

/**
 * @param animatorId Identifiant de l'animateur pédagogique consulté.
 * @param isEnabled `true` seulement quand l'appelant a structurellement une chance
 *   d'avoir ce droit (RP, TI, ou l'AP lui-même) — évite un appel réseau voué à
 *   l'échec. Le serveur reste seul juge du droit réel.
 */
export function useAnimatedTeachers(
  animatorId: string | undefined,
  isEnabled: boolean,
): UseRelationListResult<AnimatorTeacherRelation> {
  return useRelationList(
    fetchAnimatedTeachers,
    animatorId,
    isEnabled,
    'Impossible de charger les formateurs animés.',
  )
}
