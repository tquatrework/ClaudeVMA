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

  /**
   * true lorsque la liste ne peut pas être chargée pour le rôle courant. Seul
   * `GET /finance/teacher-payment-requests/by-teacher/:teacherId` existe côté backend : il n'y a
   * aucun endpoint de liste globale (utilisable par l'administrateur financier par exemple).
   * Dans ce cas, aucun appel réseau n'est déclenché — la page doit afficher un état explicite
   * plutôt qu'une liste vide silencieuse.
   */
  isListUnavailableForRole: boolean

  /** POST /finance/teacher-payment-requests — préfixe la liste avec la demande créée (optimiste). */
  submitRequest: (payload: CreateTeacherPaymentRequestPayload) => Promise<boolean>
  isSubmittingRequest: boolean
  submitError: string | null

  /** POST /finance/teacher-payment-requests/:id/validate — remplace la demande dans la liste. */
  validateRequest: (requestId: string) => Promise<boolean>
  validatingRequestId: string | null
  validateError: string | null
}

/**
 * useTeacherPaymentRequests — charge les demandes de paiement du formateur courant via
 * `GET /finance/teacher-payment-requests/by-teacher/:teacherId` (seul endpoint de lecture
 * existant côté backend) et expose la soumission (formateur) et la validation (AF, sur un id
 * de demande connu par un autre biais tant qu'aucun endpoint de liste globale n'existe).
 *
 * Pour tout rôle autre que formateur (notamment administrateur_financier), aucun appel réseau
 * n'est effectué : `isListUnavailableForRole` vaut `true` — ne pas fabriquer un endpoint qui
 * n'existe pas côté backend.
 *
 * Les demandes ajoutées ou validées sont fusionnées localement par-dessus la liste chargée, à
 * l'image de `useProfileDetails.addNote` — pas de rechargement complet après écriture, pour
 * reproduire le comportement préexistant (mise à jour optimiste sans rafraîchissement réseau).
 *
 * @param isFormateurRole rôle formateur de l'utilisateur courant (seul rôle pouvant lister ses
 *   propres demandes aujourd'hui).
 * @param currentTeacherId id de l'utilisateur courant, utilisé comme `teacherId` dans l'appel
 *   `by-teacher/:teacherId` lorsque `isFormateurRole` est vrai.
 */
export function useTeacherPaymentRequests(
  isFormateurRole: boolean,
  currentTeacherId: string | undefined,
): UseTeacherPaymentRequestsResult {
  const canListRequests = isFormateurRole && Boolean(currentTeacherId)

  const { data, isLoading, error: loadError } = useAsyncData(
    () =>
      canListRequests
        ? fetchTeacherPaymentRequests(currentTeacherId as string)
        : Promise.resolve([]),
    [canListRequests, currentTeacherId],
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
    isListUnavailableForRole: !canListRequests,
    submitRequest,
    isSubmittingRequest,
    submitError,
    validateRequest,
    validatingRequestId,
    validateError,
  }
}
