/**
 * useStudentsOfTeacher — élèves actifs d'un formateur (sens inverse de
 * `useTeacherStudentRelations`), `GET /relations/teacher-student/by-teacher/:teacherId`
 * (`docs/routes.md` § profile-service > Relations, PR #212, 2026-09-02). Complément
 * « Contacts essentiels » : professeur → élèves.
 */

import { fetchStudentsOfTeacher } from '../../api/relations'
import type { StudentOfTeacherRelation } from '../../types/profile'
import { useRelationList, type UseRelationListResult } from './useRelationList'

/**
 * @param teacherId Identifiant du formateur consulté.
 * @param isEnabled `true` seulement quand l'appelant a structurellement une chance
 *   d'avoir ce droit (RP, TI, AF, ou le formateur lui-même) — évite un appel réseau
 *   voué à l'échec. Le serveur reste seul juge du droit réel.
 */
export function useStudentsOfTeacher(
  teacherId: string | undefined,
  isEnabled: boolean,
): UseRelationListResult<StudentOfTeacherRelation> {
  return useRelationList(
    fetchStudentsOfTeacher,
    teacherId,
    isEnabled,
    'Impossible de charger les élèves de ce formateur.',
  )
}
