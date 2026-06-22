/**
 * WorkflowRetryPanel — Phase 16 (orchestration-service)
 *
 * Panneau réservé aux rôles admin pour émettre des commandes idempotentes
 * vers les microservices cibles (retry manuel d'une action).
 *
 * Routes API consommées :
 *   POST /orchestration/commands
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  dispatchCommand,
  type DispatchCommandPayload,
} from '../api/orchestration'

const ADMIN_ROLES = [
  'technicien_informatique',
  'responsable_pedagogique',
  'administrateur_financier',
] as const

const KNOWN_SERVICES = [
  'identity-access-service',
  'profile-service',
  'dashboard-notification-service',
  'calendar-service',
  'teacher-request-service',
  'video-session-service',
  'pedagogical-log-service',
  'communication-service',
  'archive-document-service',
  'finance-credit-service',
  'content-catalog-service',
  'learning-activity-service',
  'community-path-service',
]

function generateIdempotencyKey(): string {
  return `retry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function WorkflowRetryPanel() {
  const { hasRole } = useAuth()

  const [targetService, setTargetService] = useState('')
  const [action, setAction] = useState('')
  const [payloadText, setPayloadText] = useState('{}')
  const [correlationId, setCorrelationId] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canAccess = ADMIN_ROLES.some((role) => hasRole(role))

  if (!canAccess) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques, responsables pédagogiques et administrateurs
          financiers.
        </p>
      </Layout>
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(payloadText)
    } catch {
      setSubmitError('Le payload doit être un JSON valide.')
      return
    }

    const commandPayload: DispatchCommandPayload = {
      targetService,
      action,
      payload: parsedPayload,
      idempotencyKey,
      correlationId: correlationId.trim() || undefined,
    }

    setIsSubmitting(true)
    try {
      await dispatchCommand(commandPayload)
      setSuccessMessage(
        `Commande "${action}" dispatchée vers ${targetService} avec succès.`,
      )
      setIdempotencyKey(generateIdempotencyKey())
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setSubmitError(
          'Cette clé d\'idempotence a déjà été utilisée. Regénérez la clé pour réessayer.',
        )
      } else {
        setSubmitError('Impossible d\'envoyer la commande. Vérifiez les paramètres.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes manuelles</h1>
          <p className="text-gray-500 text-sm mt-1">
            Émettre une commande idempotente vers un microservice cible (retry ou action forcée).
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Service cible */}
            <div>
              <label
                htmlFor="targetService"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Service cible
              </label>
              <select
                id="targetService"
                value={targetService}
                onChange={(e) => setTargetService(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sélectionner un service…</option>
                {KNOWN_SERVICES.map((serviceName) => (
                  <option key={serviceName} value={serviceName}>
                    {serviceName}
                  </option>
                ))}
              </select>
            </div>

            {/* Action */}
            <div>
              <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <input
                id="action"
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="ex : create-student-profiles"
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Payload JSON */}
            <div>
              <label htmlFor="payload" className="block text-sm font-medium text-gray-700 mb-1">
                Payload (JSON)
              </label>
              <textarea
                id="payload"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* correlationId (optionnel) */}
            <div>
              <label
                htmlFor="correlationId"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                correlationId{' '}
                <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="correlationId"
                type="text"
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
                placeholder="UUID du workflow concerné"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Clé d'idempotence */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="idempotencyKey"
                  className="block text-sm font-medium text-gray-700"
                >
                  Clé d'idempotence
                </label>
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Regénérer
                </button>
              </div>
              <input
                id="idempotencyKey"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Messages feedback */}
            {submitError && (
              <p className="text-red-600 text-sm">{submitError}</p>
            )}
            {successMessage && (
              <p className="text-green-600 text-sm">{successMessage}</p>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={isSubmitting || !targetService || !action}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Envoi en cours…' : 'Dispatcher la commande'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
