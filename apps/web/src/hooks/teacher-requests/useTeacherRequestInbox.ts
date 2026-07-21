import { useCallback, useState } from 'react'
import { fetchTeacherRequests, respondToTeacherProposal } from '../../api/teacherRequests'
import type { TeacherRequestInboxItem } from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * Reproduit la normalisation et le filtrage préexistants de TeacherRequestInbox :
 * accepte tableau brut ou enveloppe `{ data: [...] }`, ne conserve que les demandes où
 * le formateur est candidat (`pending` / `candidates_selected`).
 */
async function loadInboxRequests(): Promise<TeacherRequestInboxItem[]> {
  try {
    const data = await fetchTeacherRequests()
    const requestList = Array.isArray(data)
      ? data
      : (data as { data: TeacherRequestInboxItem[] }).data ?? []
    return (requestList as TeacherRequestInboxItem[]).filter(
      (request) => request.status === 'pending' || request.status === 'candidates_selected',
    )
  } catch (caughtError) {
    const message = getErrorStatus(caughtError) === 403 ? 'Accès refusé' : 'Impossible de charger les demandes'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques de TeacherRequestInbox selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

export interface UseTeacherRequestInboxResult {
  inboxRequests: TeacherRequestInboxItem[]
  isLoading: boolean
  /** Combine l'erreur de chargement et l'erreur de réponse — une seule bannière affichée à la fois. */
  errorMessage: string | null
  clearErrorMessage: () => void
  processingRequestId: string | null
  successMessage: string | null
  clearSuccessMessage: () => void
  handleRespond: (
    requestId: string,
    candidateId: string | undefined,
    responseStatus: 'accepted' | 'declined',
  ) => Promise<void>
}

/**
 * useTeacherRequestInbox — charge la boîte de réception du formateur (demandes où il
 * est candidat) et expose la réponse (accepter/refuser). Reproduit le comportement
 * préexistant : la demande répondue disparaît localement de la liste (pas de
 * rechargement réseau).
 */
export function useTeacherRequestInbox(currentTeacherId: string): UseTeacherRequestInboxResult {
  const { data, isLoading, error: loadError } = useAsyncData(loadInboxRequests, [currentTeacherId])

  const [removedRequestIds, setRemovedRequestIds] = useState<Set<string>>(new Set())
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [respondErrorMessage, setRespondErrorMessage] = useState<string | null>(null)
  const [isLoadErrorDismissed, setIsLoadErrorDismissed] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const errorMessage = respondErrorMessage ?? (isLoadErrorDismissed ? null : loadError)

  const inboxRequests = (data ?? []).filter((request) => !removedRequestIds.has(request.id))

  const handleRespond = useCallback(
    async (
      requestId: string,
      candidateId: string | undefined,
      responseStatus: 'accepted' | 'declined',
    ) => {
      setProcessingRequestId(requestId)
      setRespondErrorMessage(null)
      try {
        // candidateId est l'ID de la proposition quand disponible ; repli sur requestId sinon.
        const proposalId = candidateId ?? requestId
        await respondToTeacherProposal(proposalId, responseStatus)

        setRemovedRequestIds((previous) => new Set(previous).add(requestId))
        setSuccessMessage(
          responseStatus === 'accepted'
            ? 'Demande acceptée — vous serez contacté prochainement'
            : 'Demande refusée',
        )
      } catch (caughtError: unknown) {
        setRespondErrorMessage(extractMessage(caughtError, 'Erreur lors de la réponse'))
      } finally {
        setProcessingRequestId(null)
      }
    },
    [],
  )

  const clearErrorMessage = useCallback(() => {
    setRespondErrorMessage(null)
    setIsLoadErrorDismissed(true)
  }, [])

  const clearSuccessMessage = useCallback(() => setSuccessMessage(null), [])

  return {
    inboxRequests,
    isLoading,
    errorMessage,
    clearErrorMessage,
    processingRequestId,
    successMessage,
    clearSuccessMessage,
    handleRespond,
  }
}
