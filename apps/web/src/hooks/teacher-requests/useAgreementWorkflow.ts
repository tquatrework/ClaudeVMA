import { useCallback, useState } from 'react'
import {
  fetchWorkflowArbitrationInstance,
  resumeWorkflow,
  suspendWorkflow,
} from '../../api/orchestration'
import type { WorkflowArbitrationInstance } from '../../api/orchestration'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadArbitrationInstance(
  requestId: string | undefined,
): Promise<WorkflowArbitrationInstance> {
  if (!requestId) return pendingForever<WorkflowArbitrationInstance>()

  try {
    return await fetchWorkflowArbitrationInstance(requestId)
  } catch (caughtError) {
    const message =
      getErrorStatus(caughtError) === 404
        ? 'Demande introuvable ou déjà traitée'
        : 'Impossible de charger la demande'
    // Forme reconnue en priorité par getErrorMessage (response.data.message), pour reproduire
    // exactement les messages historiques d'AgreementsPage selon le statut HTTP.
    throw { response: { data: { message } } }
  }
}

export interface UseAgreementWorkflowResult {
  instance: WorkflowArbitrationInstance | null
  isLoading: boolean
  loadError: string | null

  /** Accepte (résume) ou refuse (suspend) la demande d'accord. */
  respond: (decision: 'accept' | 'refuse') => Promise<boolean>
  isProcessing: boolean
  respondError: string | null
}

/**
 * useAgreementWorkflow — charge l'instance de workflow en attente d'arbitrage
 * (AgreementsPage, FRONT-BR-009) et expose la réponse de l'utilisateur, tracée via
 * orchestration-service : `accept` reprend le workflow (`resumeWorkflow`), `refuse`
 * le suspend avec un motif fixe (`suspendWorkflow`), à l'identique du comportement
 * préexistant. L'erreur de réponse reste un message générique unique, quelle que
 * soit la cause — reproduit tel quel (le composant d'origine n'inspectait jamais
 * l'erreur capturée).
 */
export function useAgreementWorkflow(requestId: string | undefined): UseAgreementWorkflowResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadArbitrationInstance(requestId),
    [requestId],
  )

  const [isProcessing, setIsProcessing] = useState(false)
  const [respondError, setRespondError] = useState<string | null>(null)

  const respond = useCallback(
    async (decision: 'accept' | 'refuse'): Promise<boolean> => {
      if (!requestId) return false
      setIsProcessing(true)
      try {
        if (decision === 'accept') {
          await resumeWorkflow(requestId)
        } else {
          await suspendWorkflow(requestId, { reason: "Refusé par l'utilisateur" })
        }
        return true
      } catch {
        setRespondError('Erreur lors du traitement de votre réponse')
        return false
      } finally {
        setIsProcessing(false)
      }
    },
    [requestId],
  )

  return {
    instance: data ?? null,
    isLoading,
    loadError,
    respond,
    isProcessing,
    respondError,
  }
}
