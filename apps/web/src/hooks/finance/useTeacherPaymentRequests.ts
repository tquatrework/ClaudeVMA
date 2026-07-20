import { useCallback, useState } from 'react'
import {
  createTeacherPaymentRequest,
  fetchTeacherPaymentRequests,
  validateTeacherPaymentRequest,
} from '../../api/finance'
import type { CreateTeacherPaymentRequestPayload, TeacherPaymentRequest } from '../../api/finance'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherPaymentRequestsResult {
  paymentRequests: TeacherPaymentRequest[]
  isLoadingRequests: boolean
  loadError: string | null

  /** POST /teacher-payment-requests — préfixe la liste avec la demande créée (optimiste). */
  submitRequest: (payload: CreateTeacherPaymentRequestPayload) => Promise<boolean>
  isSubmittingRequest: boolean
  submitError: string | null

  /** POST /teacher-payment-requests/:id/validate — remplace la demande dans la liste. */
  validateRequest: (requestId: string) => Promise<boolean>
  validatingRequestId: string | null
  validateError: string | null
}

/**
 * useTeacherPaymentRequests — charge les demandes de paiement formateur (filtrées côté serveur
 * selon le rôle : formateur voit les siennes, AF voit tout) et expose la soumission (formateur)
 * et la validation (AF).
 *
 * Les demandes ajoutées ou validées sont fusionnées localement par-dessus la liste chargée, à
 * l'image de `useProfileDetails.addNote` — pas de rechargement complet après écriture, pour
 * reproduire le comportement préexistant (mise à jour optimiste sans rafraîchissement réseau).
 */
export function useTeacherPaymentRequests(): UseTeacherPaymentRequestsResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => fetchTeacherPaymentRequests(),
    [],
    { fallbackErrorMessage: 'Erreur lors du chargement des demandes de paiement' },
  )

  const [addedRequests, setAddedRequests] = useState<TeacherPaymentRequest[]>([])
  const [updatedById, setUpdatedById] = useState<Record<string, TeacherPaymentRequest>>({})

  const paymentRequests = [...addedRequests, ...(data ?? [])].map(
    (request) => updatedById[request.id] ?? request,
  )

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitRequest = useCallback(
    async (payload: CreateTeacherPaymentRequestPayload): Promise<boolean> => {
      setIsSubmittingRequest(true)
      setSubmitError(null)
      try {
        const created = await createTeacherPaymentRequest(payload)
        setAddedRequests((previous) => [created, ...previous])
        return true
      } catch (caughtError) {
        setSubmitError(
          getErrorMessage(caughtError, 'Impossible de soumettre la demande de paiement.'),
        )
        return false
      } finally {
        setIsSubmittingRequest(false)
      }
    },
    [],
  )

  const [validatingRequestId, setValidatingRequestId] = useState<string | null>(null)
  const [validateError, setValidateError] = useState<string | null>(null)

  const validateRequest = useCallback(async (requestId: string): Promise<boolean> => {
    setValidatingRequestId(requestId)
    setValidateError(null)
    try {
      const updated = await validateTeacherPaymentRequest(requestId)
      setUpdatedById((previous) => ({ ...previous, [requestId]: updated }))
      return true
    } catch (caughtError) {
      setValidateError(getErrorMessage(caughtError, 'Impossible de valider la demande de paiement.'))
      return false
    } finally {
      setValidatingRequestId(null)
    }
  }, [])

  return {
    paymentRequests,
    isLoadingRequests: isLoading,
    loadError,
    submitRequest,
    isSubmittingRequest,
    submitError,
    validateRequest,
    validatingRequestId,
    validateError,
  }
}
