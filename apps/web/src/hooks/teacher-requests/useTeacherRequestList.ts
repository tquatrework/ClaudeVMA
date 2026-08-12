import { useCallback, useEffect, useState } from 'react'
import { createTeacherRequest, fetchTeacherRequests } from '../../api/teacherRequests'
import type {
  CreateTeacherRequestPayload,
  TeacherRequest,
  TeacherRequestScope,
} from '../../types/teacherRequests'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseTeacherRequestListResult {
  requests: TeacherRequest[]
  isLoading: boolean
  loadError: string | null

  /** POST /teacher-requests — la demande créée est ajoutée localement, sans rechargement. */
  submitRequest: (payload: CreateTeacherRequestPayload) => Promise<boolean>
  isSubmitting: boolean
  submitError: string | null
  clearSubmitError: () => void
}

/**
 * useTeacherRequestList — chargement **au niveau de la page** de la liste des demandes
 * (élève, parent financeur, RP), et création d'une demande.
 *
 * Un seul chargement : trois composants rechargeaient auparavant `GET /teacher-requests`
 * chacun de leur côté, avec trois normalisations différentes de la même réponse.
 *
 * La réponse d'écriture **remonte** au propriétaire de l'état (arbitrage du 2026-08-10) :
 * la demande créée est celle que le serveur renvoie — avec son `studentName` résolu et son
 * statut réel —, jamais le corps envoyé, et aucune requête de relecture n'est déclenchée.
 */
export function useTeacherRequestList(
  scope: TeacherRequestScope = 'open',
): UseTeacherRequestListResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => fetchTeacherRequests(scope),
    [scope],
    { fallbackErrorMessage: 'Impossible de charger les demandes.' },
  )

  const [createdRequests, setCreatedRequests] = useState<TeacherRequest[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Changer de portée relit la liste côté serveur : les ajouts locaux de la portée
  // précédente n'ont plus lieu d'être empilés par-dessus.
  useEffect(() => {
    setCreatedRequests([])
  }, [scope])

  const submitRequest = useCallback(
    async (payload: CreateTeacherRequestPayload): Promise<boolean> => {
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const createdRequest = await createTeacherRequest(payload)
        setCreatedRequests((previous) => [createdRequest, ...previous])
        return true
      } catch (caughtError) {
        setSubmitError(
          getErrorMessage(caughtError, "La demande n'a pas pu être créée. Veuillez réessayer."),
        )
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  const clearSubmitError = useCallback(() => setSubmitError(null), [])

  return {
    requests: [...createdRequests, ...(data ?? [])],
    isLoading,
    loadError,
    submitRequest,
    isSubmitting,
    submitError,
    clearSubmitError,
  }
}
