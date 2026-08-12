import { useCallback, useEffect, useState } from 'react'
import {
  deleteTeacherRequest,
  fetchTeacherProposals,
  fetchTeacherRequest,
  sendTeacherProposals,
  updateTeacherRequestStatus,
  validateTeacherRequest,
} from '../../api/teacherRequests'
import type {
  SendTeacherProposalsPayload,
  TeacherProposal,
  TeacherRequest,
  UpdateTeacherRequestStatusPayload,
  ValidateTeacherRequestPayload,
} from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

interface TeacherRequestDetailData {
  request: TeacherRequest
  proposals: TeacherProposal[]
}

/**
 * Un seul chargement pour toute la page : la demande, et — pour le RP seul — les
 * propositions déjà envoyées. `GET /teacher-requests/:id/proposals` répond `403` à tout
 * autre rôle : on ne l'appelle donc pas, plutôt que d'afficher un refus prévisible.
 */
async function loadTeacherRequestDetail(
  requestId: string | undefined,
  canManageProposals: boolean,
): Promise<TeacherRequestDetailData> {
  if (!requestId) {
    // Sans identifiant de route, il n'y a rien à charger et rien à afficher : on laisse
    // la page en chargement plutôt que d'inventer une erreur que l'utilisateur ne peut
    // pas corriger.
    return new Promise<TeacherRequestDetailData>(() => {})
  }

  const request = await fetchTeacherRequest(requestId)
  const proposals = canManageProposals ? await fetchTeacherProposals(requestId) : []
  return { request, proposals }
}

export interface UseTeacherRequestDetailResult {
  request: TeacherRequest | null
  proposals: TeacherProposal[]
  isLoading: boolean
  loadError: string | null

  /** Étape 3 — POST /teacher-requests/:id/proposals (envoi groupé). */
  sendProposals: (payload: SendTeacherProposalsPayload) => Promise<boolean>
  isSendingProposals: boolean

  /** Étapes 5 et 6 — POST /teacher-requests/:id/validate. */
  validateProposal: (payload: ValidateTeacherRequestPayload) => Promise<boolean>
  isValidating: boolean

  /** PATCH /teacher-requests/:id/status — RP uniquement. */
  changeStatus: (payload: UpdateTeacherRequestStatusPayload) => Promise<boolean>
  isChangingStatus: boolean

  /** DELETE /teacher-requests/:id — RP uniquement. */
  removeRequest: () => Promise<boolean>

  actionError: string | null
  clearActionError: () => void
  successMessage: string | null
  clearSuccessMessage: () => void
}

/**
 * useTeacherRequestDetail — état de la page de détail d'une demande.
 *
 * Toutes les écritures **réaffichent la réponse reçue** et jamais le corps envoyé
 * (arbitrage du 2026-08-10) : le serveur pose `chosenTeacherName`, `closedAt` et le
 * statut réel, que le client ne peut pas deviner. Aucune relecture n'est déclenchée
 * après une écriture.
 */
export function useTeacherRequestDetail(
  requestId: string | undefined,
  canManageProposals: boolean,
): UseTeacherRequestDetailResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadTeacherRequestDetail(requestId, canManageProposals),
    [requestId, canManageProposals],
    { fallbackErrorMessage: 'Impossible de charger cette demande.' },
  )

  const [requestOverride, setRequestOverride] = useState<TeacherRequest | null>(null)
  const [proposalsOverride, setProposalsOverride] = useState<TeacherProposal[] | null>(null)
  const [isSendingProposals, setIsSendingProposals] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    setRequestOverride(null)
    setProposalsOverride(null)
    setActionError(null)
    setSuccessMessage(null)
  }, [requestId])

  const sendProposals = useCallback(
    async (payload: SendTeacherProposalsPayload): Promise<boolean> => {
      if (!requestId) return false
      setIsSendingProposals(true)
      setActionError(null)
      try {
        const createdProposals = await sendTeacherProposals(requestId, payload)
        setProposalsOverride((previous) => [
          ...createdProposals,
          ...(previous ?? data?.proposals ?? []),
        ])
        // La demande bascule en `redirected` : on le reflète sans relire le serveur.
        setRequestOverride((previous) => {
          const currentRequest = previous ?? data?.request
          return currentRequest ? { ...currentRequest, status: 'redirected' } : previous
        })
        setSuccessMessage(
          `Proposition envoyée à ${createdProposals.length} formateur${
            createdProposals.length > 1 ? 's' : ''
          }.`,
        )
        return true
      } catch (caughtError) {
        setActionError(
          getErrorMessage(caughtError, "La proposition n'a pas pu être envoyée."),
        )
        return false
      } finally {
        setIsSendingProposals(false)
      }
    },
    [requestId, data],
  )

  const validateProposal = useCallback(
    async (payload: ValidateTeacherRequestPayload): Promise<boolean> => {
      if (!requestId) return false
      setIsValidating(true)
      setActionError(null)
      try {
        const closedRequest = await validateTeacherRequest(requestId, payload)
        setRequestOverride(closedRequest)
        // La clôture solde toutes les propositions : on relit celles-ci, seule donnée que
        // la réponse ne porte pas. Ce n'est pas un rechargement de la page, mais la
        // lecture d'une ressource distincte que l'écriture vient de modifier.
        try {
          setProposalsOverride(await fetchTeacherProposals(requestId))
        } catch {
          setProposalsOverride(null)
        }
        setSuccessMessage(
          closedRequest.chosenTeacherName
            ? `${closedRequest.chosenTeacherName} accompagnera désormais cet élève.`
            : 'Le professeur retenu accompagnera désormais cet élève.',
        )
        return true
      } catch (caughtError) {
        setActionError(
          getErrorMessage(caughtError, "Le professeur n'a pas pu être retenu."),
        )
        return false
      } finally {
        setIsValidating(false)
      }
    },
    [requestId],
  )

  const changeStatus = useCallback(
    async (payload: UpdateTeacherRequestStatusPayload): Promise<boolean> => {
      if (!requestId) return false
      setIsChangingStatus(true)
      setActionError(null)
      try {
        const updatedRequest = await updateTeacherRequestStatus(requestId, payload)
        setRequestOverride(updatedRequest)
        setSuccessMessage('Le statut de la demande a été mis à jour.')
        return true
      } catch (caughtError) {
        setActionError(
          getErrorMessage(caughtError, "Le statut n'a pas pu être modifié."),
        )
        return false
      } finally {
        setIsChangingStatus(false)
      }
    },
    [requestId],
  )

  const removeRequest = useCallback(async (): Promise<boolean> => {
    if (!requestId) return false
    setActionError(null)
    try {
      await deleteTeacherRequest(requestId)
      return true
    } catch (caughtError) {
      setActionError(getErrorMessage(caughtError, "La demande n'a pas pu être supprimée."))
      return false
    }
  }, [requestId])

  return {
    request: data ? (requestOverride ?? data.request) : null,
    proposals: proposalsOverride ?? data?.proposals ?? [],
    isLoading,
    loadError,
    sendProposals,
    isSendingProposals,
    validateProposal,
    isValidating,
    changeStatus,
    isChangingStatus,
    removeRequest,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    successMessage,
    clearSuccessMessage: useCallback(() => setSuccessMessage(null), []),
  }
}
