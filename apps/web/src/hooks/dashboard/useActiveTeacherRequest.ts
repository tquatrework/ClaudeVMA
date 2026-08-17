import { fetchTeacherRequests } from '../../api/teacherRequests'
import { useAsyncData } from '../useAsyncData'

export interface UseActiveTeacherRequestResult {
  /**
   * `true` si l'élève a au moins une demande de professeur (ou de changement de
   * professeur principal) encore ouverte — pas encore résolue par une affectation
   * ni close par le RP.
   */
  hasActiveRequest: boolean
  isLoadingActiveRequest: boolean
}

/**
 * useActiveTeacherRequest — troisième état du dashboard élève : « Demande en cours ».
 *
 * `GET /teacher-requests?scope=open` (docs/routes.md § teacher-request-service) renvoie déjà,
 * pour un appelant élève, ses propres demandes dont le statut n'est pas terminal
 * (`pending` / `redirected`, ou une valeur héritée non close) — `closed`, `cancelled` et
 * `declined` en sont exclus côté serveur. Aucun filtrage supplémentaire n'est donc nécessaire
 * ici : la présence d'au moins une ligne suffit à qualifier une demande active.
 *
 * Couvre aussi bien une première demande (« pas de professeur ») qu'une demande de
 * changement de professeur principal (`POST /teacher-requests/pp-change`) : les deux
 * apparaissent dans la même liste, avec le même statut ouvert.
 */
export function useActiveTeacherRequest(
  studentId: string | undefined,
): UseActiveTeacherRequestResult {
  const { data, isLoading } = useAsyncData(
    () => (studentId ? fetchTeacherRequests('open') : Promise.resolve([])),
    [studentId],
    { fallbackErrorMessage: 'Impossible de vérifier les demandes en cours' },
  )

  return {
    hasActiveRequest: (data ?? []).length > 0,
    isLoadingActiveRequest: isLoading,
  }
}
