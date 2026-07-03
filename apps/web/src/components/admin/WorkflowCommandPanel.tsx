/**
 * WorkflowCommandPanel — Panneau "Commandes" de AdminActivityPage
 *
 * Émet des commandes idempotentes vers les microservices via orchestration-service.
 * Route API : POST /orchestration/commands
 */

import React, { useState } from 'react'
import apiClient from '../../api/client'
import { ErrorMessage } from '../ui/ErrorMessage'

export function WorkflowCommandPanel() {
  const [commandTargetService, setCommandTargetService] = useState('')
  const [commandAction, setCommandAction] = useState('')
  const [commandPayload, setCommandPayload] = useState('{}')
  const [commandIdempotencyKey, setCommandIdempotencyKey] = useState('')
  const [isSendingCommand, setIsSendingCommand] = useState(false)
  const [commandResult, setCommandResult] = useState<string | null>(null)
  const [commandError, setCommandError] = useState<string | null>(null)

  const handleSendCommand = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!commandTargetService.trim() || !commandAction.trim()) return
    setIsSendingCommand(true)
    setCommandError(null)
    setCommandResult(null)

    let parsedPayload: unknown = {}
    try {
      parsedPayload = JSON.parse(commandPayload)
    } catch {
      setCommandError('Le payload doit être un JSON valide')
      setIsSendingCommand(false)
      return
    }

    try {
      const { data } = await apiClient.post('/orchestration/commands', {
        targetService: commandTargetService.trim(),
        action: commandAction.trim(),
        payload: parsedPayload,
        idempotencyKey: commandIdempotencyKey.trim() || crypto.randomUUID(),
      })
      setCommandResult(JSON.stringify(data, null, 2))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'envoi de la commande"
      setCommandError(message)
    } finally {
      setIsSendingCommand(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Commande d'intégration</h2>
        <p className="text-sm text-gray-500">
          Émet une commande idempotente vers un microservice cible. Utilisez une clé d'idempotence
          unique pour éviter les doublons.
        </p>
      </div>

      {commandError && (
        <ErrorMessage message={commandError} onClose={() => setCommandError(null)} />
      )}

      {commandResult && (
        <div>
          <p className="text-sm font-medium text-green-700 mb-2">Réponse :</p>
          <pre className="p-4 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 overflow-auto">
            {commandResult}
          </pre>
        </div>
      )}

      <form
        onSubmit={handleSendCommand}
        className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service cible <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={commandTargetService}
              onChange={(e) => setCommandTargetService(e.target.value)}
              placeholder="Ex : identity-access-service"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={commandAction}
              onChange={(e) => setCommandAction(e.target.value)}
              placeholder="Ex : validate-account"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clé d'idempotence
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={commandIdempotencyKey}
              onChange={(e) => setCommandIdempotencyKey(e.target.value)}
              placeholder="Laissez vide pour générer automatiquement"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={() => setCommandIdempotencyKey(crypto.randomUUID())}
              className="text-xs border border-gray-200 text-gray-500 px-3 py-2 rounded-lg hover:border-indigo-300 hover:text-indigo-600 whitespace-nowrap"
            >
              Générer
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payload (JSON)
          </label>
          <textarea
            value={commandPayload}
            onChange={(e) => setCommandPayload(e.target.value)}
            rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSendingCommand || !commandTargetService.trim() || !commandAction.trim()}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSendingCommand ? 'Envoi…' : 'Envoyer la commande'}
        </button>
      </form>
    </div>
  )
}
