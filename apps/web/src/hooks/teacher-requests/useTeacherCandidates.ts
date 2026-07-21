import { useCallback, useState } from 'react'
import {
  addTeacherCandidate,
  respondToTeacherProposal,
  selectTeacherCandidate,
} from '../../api/teacherRequests'
import type { TeacherCandidate } from '../../components/teacher-requests/TeacherCandidatesView'

export interface UseTeacherCandidatesResult {
  isSubmittingCandidate: boolean
  processingCandidateId: string | null
  errorMessage: string | null
  successMessage: string | null
  clearError: () => void
  clearSuccess: () => void
  /** POST /teacher-requests/:id/proposals — retourne la liste mise à jour, ou `null` en erreur. */
  addCandidate: (teacherId: string) => Promise<TeacherCandidate[] | undefined | null>
  /** POST /proposals/:id/accept|decline (réponse du formateur à sa propre candidature). */
  respondAsTeacher: (candidateId: string, responseStatus: 'accepted' | 'declined') => Promise<boolean>
  /** POST /teacher-requests/:id/select — retourne le nouveau statut, ou `null` en erreur. */
  selectCandidate: (candidateId: string) => Promise<string | null>
}

function extractMessage(caughtError: unknown, fallback: string): string {
  return (
    (caughtError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback
  )
}

/**
 * useTeacherCandidates — orchestration de TeacherCandidatesView : ajout de candidat
 * (RP), réponse du formateur (accepter/refuser), sélection par le client. Reproduit le
 * comportement préexistant (extraction brute du message d'erreur backend, messages de
 * succès dédiés par action).
 */
export function useTeacherCandidates(requestId: string): UseTeacherCandidatesResult {
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false)
  const [processingCandidateId, setProcessingCandidateId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const addCandidate = useCallback(
    async (teacherId: string): Promise<TeacherCandidate[] | undefined | null> => {
      setIsSubmittingCandidate(true)
      setErrorMessage(null)
      try {
        const updatedCandidates = await addTeacherCandidate(requestId, teacherId)
        setSuccessMessage('Candidat ajouté avec succès')
        return updatedCandidates
      } catch (caughtError: unknown) {
        setErrorMessage(extractMessage(caughtError, "Erreur lors de l'ajout du candidat"))
        return null
      } finally {
        setIsSubmittingCandidate(false)
      }
    },
    [requestId],
  )

  const respondAsTeacher = useCallback(
    async (candidateId: string, responseStatus: 'accepted' | 'declined'): Promise<boolean> => {
      setProcessingCandidateId(candidateId)
      setErrorMessage(null)
      try {
        await respondToTeacherProposal(candidateId, responseStatus)
        setSuccessMessage(responseStatus === 'accepted' ? 'Demande acceptée' : 'Demande refusée')
        return true
      } catch (caughtError: unknown) {
        setErrorMessage(extractMessage(caughtError, 'Erreur lors de la réponse'))
        return false
      } finally {
        setProcessingCandidateId(null)
      }
    },
    [],
  )

  const selectCandidate = useCallback(
    async (candidateId: string): Promise<string | null> => {
      setProcessingCandidateId(candidateId)
      setErrorMessage(null)
      try {
        const status = await selectTeacherCandidate(requestId, candidateId)
        setSuccessMessage('Formateur sélectionné — demande clôturée')
        return status ?? 'accepted'
      } catch (caughtError: unknown) {
        setErrorMessage(extractMessage(caughtError, 'Erreur lors de la sélection'))
        return null
      } finally {
        setProcessingCandidateId(null)
      }
    },
    [requestId],
  )

  const clearError = useCallback(() => setErrorMessage(null), [])
  const clearSuccess = useCallback(() => setSuccessMessage(null), [])

  return {
    isSubmittingCandidate,
    processingCandidateId,
    errorMessage,
    successMessage,
    clearError,
    clearSuccess,
    addCandidate,
    respondAsTeacher,
    selectCandidate,
  }
}
