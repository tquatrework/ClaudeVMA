import { useCallback, useState } from 'react'
import { fetchWorkflowDefinitions, startWorkflow } from '../../api/orchestration'
import type {
  StartWorkflowResponse,
  WorkflowDefinition,
  WorkflowType,
} from '../../api/orchestration'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseWorkflowActivityResult {
  availableWorkflowTypes: WorkflowDefinition[]
  isLoadingWorkflowTypes: boolean
  workflowTypesError: string | null

  /** POST /orchestration/workflows/:workflowType/start */
  launchWorkflow: (
    workflowType: WorkflowType,
    payload: Record<string, unknown>,
  ) => Promise<StartWorkflowResponse | null>
  isLaunchingWorkflow: boolean
  launchError: string | null
  resetLaunchError: () => void
}

/**
 * useWorkflowActivity — charge les types de workflows disponibles pour AdminActivityPage
 * (panneau "Workflows") et expose le déclenchement d'un workflow transverse.
 *
 * Le panneau "Instances actives" reste local à la page : aucune route de listing des
 * instances n'existe côté orchestration-service (seule `/workflows/:workflowInstanceId`
 * permet de lire une instance précise), le comportement préexistant — une liste toujours
 * vide — n'est donc pas reproduit ici mais conservé dans la page elle-même.
 */
export function useWorkflowActivity(): UseWorkflowActivityResult {
  const { data, isLoading, error: workflowTypesError } = useAsyncData(
    () => fetchWorkflowDefinitions(),
    [],
    { fallbackErrorMessage: 'Impossible de charger les types de workflows disponibles.' },
  )

  const [isLaunchingWorkflow, setIsLaunchingWorkflow] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const launchWorkflow = useCallback(
    async (
      workflowType: WorkflowType,
      payload: Record<string, unknown>,
    ): Promise<StartWorkflowResponse | null> => {
      setIsLaunchingWorkflow(true)
      setLaunchError(null)
      try {
        return await startWorkflow(workflowType, { workflowType, payload })
      } catch (caughtError) {
        setLaunchError(getErrorMessage(caughtError, 'Erreur lors du déclenchement du workflow'))
        return null
      } finally {
        setIsLaunchingWorkflow(false)
      }
    },
    [],
  )

  const resetLaunchError = useCallback(() => setLaunchError(null), [])

  return {
    availableWorkflowTypes: data ?? [],
    isLoadingWorkflowTypes: isLoading,
    workflowTypesError,
    launchWorkflow,
    isLaunchingWorkflow,
    launchError,
    resetLaunchError,
  }
}
