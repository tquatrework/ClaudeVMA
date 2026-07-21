import { useCallback, useState } from 'react'
import { fetchEventHistory } from '../../api/orchestration'
import type { IntegrationEventHistory } from '../../api/orchestration'
import { useAsyncData } from '../useAsyncData'

export interface UseWorkflowEventsSearchResult {
  eventsResult: IntegrationEventHistory | null
  isSearchingEvents: boolean
  eventsError: string | null
  /** Déclenche une recherche pour le correlationId fourni (no-op si vide). */
  searchEvents: (correlationId: string) => void
}

const FALLBACK_ERROR_MESSAGE = 'Erreur lors de la recherche des événements'

/**
 * useWorkflowEventsSearch — recherche l'historique des événements d'intégration par
 * correlationId, pour le panneau "Événements" de AdminActivityPage (WorkflowEventsPanel).
 *
 * Recherche déclenchée à la demande (formulaire), pas au montage : `submittedCorrelationId`
 * sert de dépendance à `useAsyncData`, qui protège contre une réponse obsolète si une
 * nouvelle recherche est lancée avant la résolution de la précédente. Un nouvel appel avec
 * le même correlationId déclenche un `refetch` explicite plutôt qu'un no-op (les dépendances
 * de useAsyncData ne changeraient pas sinon).
 */
export function useWorkflowEventsSearch(): UseWorkflowEventsSearchResult {
  const [submittedCorrelationId, setSubmittedCorrelationId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useAsyncData<IntegrationEventHistory | null>(
    () => (submittedCorrelationId ? fetchEventHistory(submittedCorrelationId) : Promise.resolve(null)),
    [submittedCorrelationId],
    { fallbackErrorMessage: FALLBACK_ERROR_MESSAGE },
  )

  const searchEvents = useCallback(
    (correlationId: string) => {
      const trimmedCorrelationId = correlationId.trim()
      if (!trimmedCorrelationId) return

      if (trimmedCorrelationId === submittedCorrelationId) {
        refetch()
      } else {
        setSubmittedCorrelationId(trimmedCorrelationId)
      }
    },
    [submittedCorrelationId, refetch],
  )

  return {
    eventsResult: submittedCorrelationId ? data ?? null : null,
    isSearchingEvents: submittedCorrelationId ? isLoading : false,
    eventsError: submittedCorrelationId ? error : null,
    searchEvents,
  }
}
