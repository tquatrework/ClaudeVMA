import { useCallback, useState } from 'react'
import { fetchTeacherProposalInbox, respondToTeacherProposal } from '../../api/teacherRequests'
import type {
  TeacherProposalInboxItem,
  TeacherRequestScope,
} from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherProposalInboxResult {
  proposals: TeacherProposalInboxItem[]
  isLoading: boolean
  loadError: string | null

  /** POST /proposals/:proposalId/accept|decline — accepter n'est qu'une candidature. */
  respond: (proposalId: string, responseStatus: 'accepted' | 'declined') => Promise<void>
  respondingProposalId: string | null
  respondError: string | null
  clearRespondError: () => void
  successMessage: string | null
  clearSuccessMessage: () => void
}

/**
 * useTeacherProposalInbox — boîte de réception du formateur.
 *
 * `GET /teacher-requests` renvoie au formateur ses **propositions**, pas des demandes :
 * la forme dépend du rôle. L'ancienne inbox lisait la forme « demande », ne trouvait
 * jamais de `candidateId` et se repliait sur `requestId` — elle postait donc sur
 * `/proposals/<requestId>/accept`, un identifiant qui n'est pas celui d'une proposition.
 * Ici `item.id` **est** l'identifiant de la proposition.
 *
 * La réponse d'écriture remonte au propriétaire de l'état : l'élément renvoyé par le
 * serveur remplace l'élément affiché, sans rechargement et sans le faire disparaître —
 * un formateur doit pouvoir constater ce qu'il vient de répondre.
 */
export function useTeacherProposalInbox(
  scope: TeacherRequestScope = 'open',
): UseTeacherProposalInboxResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => fetchTeacherProposalInbox(scope),
    [scope],
    { fallbackErrorMessage: 'Impossible de charger vos propositions.' },
  )

  const [respondedProposals, setRespondedProposals] = useState<
    Record<string, TeacherProposalInboxItem>
  >({})
  const [respondingProposalId, setRespondingProposalId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const respond = useCallback(
    async (proposalId: string, responseStatus: 'accepted' | 'declined') => {
      setRespondingProposalId(proposalId)
      setRespondError(null)
      try {
        const updatedProposal = await respondToTeacherProposal(proposalId, responseStatus)
        setRespondedProposals((previous) => ({ ...previous, [proposalId]: updatedProposal }))
        setSuccessMessage(
          responseStatus === 'accepted'
            ? 'Votre candidature est enregistrée. Le responsable pédagogique choisira le professeur retenu.'
            : 'Vous avez décliné cette proposition.',
        )
      } catch (caughtError) {
        setRespondError(
          getErrorMessage(caughtError, "Votre réponse n'a pas pu être enregistrée."),
        )
      } finally {
        setRespondingProposalId(null)
      }
    },
    [],
  )

  const proposals = (data ?? []).map((proposal) => respondedProposals[proposal.id] ?? proposal)

  return {
    proposals,
    isLoading,
    loadError,
    respond,
    respondingProposalId,
    respondError,
    clearRespondError: useCallback(() => setRespondError(null), []),
    successMessage,
    clearSuccessMessage: useCallback(() => setSuccessMessage(null), []),
  }
}
