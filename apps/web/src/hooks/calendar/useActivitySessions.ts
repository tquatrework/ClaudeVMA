import { fetchActivitySessions } from '../../api/calendar'
import type { ActivitySession } from '../../types/calendar'
import { useAsyncData, type UseAsyncDataResult } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * ActivitiesPage n'affichait que deux messages possibles ("Accès refusé" sur 403, message
 * générique sinon), jamais le mapping par défaut de `getErrorMessage` — on enveloppe l'erreur
 * ici pour préserver ce comportement exact.
 */
async function loadActivitySessions(
  hasTeacherId: boolean,
  hasStudentId: boolean,
  userId: string,
): Promise<ActivitySession[]> {
  try {
    return await fetchActivitySessions({
      teacherId: hasTeacherId ? userId : undefined,
      studentId: hasStudentId ? userId : undefined,
    })
  } catch (caughtError: unknown) {
    const status = getErrorStatus(caughtError)
    throw {
      response: {
        data: { message: status === 403 ? 'Accès refusé' : 'Impossible de charger les activités' },
      },
    }
  }
}

/**
 * useActivitySessions — charge les séances d'activité d'ActivitiesPage, en filtrant par
 * `teacherId` ou `studentId` selon le rôle courant (mêmes rôles que le comportement
 * préexistant). Factorise l'appel dupliqué (chargement initial + bouton "Réessayer") en un
 * seul hook basé sur `useAsyncData`, dont `refetch()` sert aussi de nouvelle tentative.
 */
export function useActivitySessions(
  userId: string | undefined,
  isTeacher: boolean,
  isStudent: boolean,
): UseAsyncDataResult<ActivitySession[]> {
  return useAsyncData(
    () => (userId ? loadActivitySessions(isTeacher, isStudent, userId) : Promise.resolve([])),
    [userId, isTeacher, isStudent],
    { fallbackErrorMessage: 'Impossible de charger les activités' },
  )
}
