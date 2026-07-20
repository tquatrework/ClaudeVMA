import { useCallback, useState } from 'react'
import { createTeacherRequest, fetchTeacherRequests } from '../../api/teacherRequests'
import type { CreateTeacherRequestPayload, TeacherRequestSummary } from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

/**
 * Reproduit la normalisation préexistante de TeacherRequestsPage : seule la forme
 * tableau brut est acceptée, toute autre forme (y compris `{ data: [...] }`) résout
 * en liste vide.
 */
async function loadTeacherRequests(): Promise<TeacherRequestSummary[]> {
  try {
    const data = await fetchTeacherRequests()
    return Array.isArray(data) ? data : []
  } catch (caughtError) {
    const message = getErrorStatus(caughtError) === 403 ? 'Accès refusé' : 'Impossible de charger les demandes'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de TeacherRequestsPage selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseTeacherRequestsResult {
  requests: TeacherRequestSummary[]
  isLoadingRequests: boolean
  loadError: string | null

  /** POST /teacher-requests — préfixe la liste avec la demande créée. */
  submitRequest: (payload: CreateTeacherRequestPayload) => Promise<boolean>
  isSubmittingRequest: boolean
  submitError: string | null
}

/**
 * useTeacherRequests — charge la liste des demandes professeur et expose la création
 * pour TeacherRequestsPage. La demande créée est préfixée localement (pas de
 * rechargement réseau), à l'image de `useTeacherPaymentRequests`.
 */
export function useTeacherRequests(): UseTeacherRequestsResult {
  const { data, isLoading, error: loadError } = useAsyncData(loadTeacherRequests, [])

  const [addedRequests, setAddedRequests] = useState<TeacherRequestSummary[]>([])
  const requests = [...addedRequests, ...(data ?? [])]

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitRequest = useCallback(
    async (payload: CreateTeacherRequestPayload): Promise<boolean> => {
      setIsSubmittingRequest(true)
      setSubmitError(null)
      try {
        const created = await createTeacherRequest(payload)
        setAddedRequests((previous) => [created, ...previous])
        return true
      } catch (caughtError) {
        setSubmitError(getErrorMessage(caughtError, 'Erreur lors de la création de la demande'))
        return false
      } finally {
        setIsSubmittingRequest(false)
      }
    },
    [],
  )

  return {
    requests,
    isLoadingRequests: isLoading,
    loadError,
    submitRequest,
    isSubmittingRequest,
    submitError,
  }
}
