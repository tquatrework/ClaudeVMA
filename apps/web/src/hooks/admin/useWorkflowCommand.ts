import { useCallback, useState } from 'react'
import { dispatchCommand } from '../../api/orchestration'
import type { DispatchCommandPayload } from '../../api/orchestration'
import { getErrorMessage } from '../../utils/apiError'

export interface UseWorkflowCommandResult {
  /** POST /orchestration/commands */
  sendCommand: (payload: DispatchCommandPayload) => Promise<{ message: string } | null>
  isSendingCommand: boolean
  commandError: string | null
  resetCommandError: () => void
}

/**
 * useWorkflowCommand — émet une commande idempotente vers un microservice cible,
 * pour le panneau "Commandes" de AdminActivityPage (WorkflowCommandPanel).
 */
export function useWorkflowCommand(): UseWorkflowCommandResult {
  const [isSendingCommand, setIsSendingCommand] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)

  const sendCommand = useCallback(
    async (payload: DispatchCommandPayload): Promise<{ message: string } | null> => {
      setIsSendingCommand(true)
      setCommandError(null)
      try {
        return await dispatchCommand(payload)
      } catch (caughtError) {
        setCommandError(getErrorMessage(caughtError, "Erreur lors de l'envoi de la commande"))
        return null
      } finally {
        setIsSendingCommand(false)
      }
    },
    [],
  )

  const resetCommandError = useCallback(() => setCommandError(null), [])

  return { sendCommand, isSendingCommand, commandError, resetCommandError }
}
