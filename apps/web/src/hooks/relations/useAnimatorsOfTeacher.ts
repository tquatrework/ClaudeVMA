/**
 * useAnimatorsOfTeacher — le ou les AP qui animent un formateur (sens inverse de
 * `useAnimatedTeachers`), `GET /relations/animator-teacher/by-teacher/:teacherId`
 * (`docs/routes.md` § profile-service > Relations, PR #212, 2026-09-02). Complément
 * « Contacts essentiels » : professeur → AP.
 */

import { fetchAnimatorsOfTeacher } from '../../api/relations'
import type { AnimatorOfTeacherRelation } from '../../types/profile'
import { useRelationList, type UseRelationListResult } from './useRelationList'

/**
 * @param teacherId Identifiant du formateur consulté.
 * @param isEnabled `true` seulement quand l'appelant a structurellement une chance
 *   d'avoir ce droit (RP, TI, ou le formateur lui-même — l'AF en est exclu, comme
 *   côté serveur) — évite un appel réseau voué à l'échec.
 */
export function useAnimatorsOfTeacher(
  teacherId: string | undefined,
  isEnabled: boolean,
): UseRelationListResult<AnimatorOfTeacherRelation> {
  return useRelationList(
    fetchAnimatorsOfTeacher,
    teacherId,
    isEnabled,
    'Impossible de charger les animateurs pédagogiques de ce formateur.',
  )
}
