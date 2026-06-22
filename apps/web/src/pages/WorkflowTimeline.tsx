/**
 * WorkflowTimeline — Phase 16 (orchestration-service)
 *
 * Affiche le détail d'une instance de workflow : statut global, étapes
 * chronologiques et actions (suspend / resume) réservées aux admins.
 *
 * Routes API consommées :
 *   GET /orchestration/workflows/:workflowInstanceId
 *   POST /orchestration/workflows/:workflowInstanceId/suspend
 *   POST /orchestration/workflows/:workflowInstanceId/resume
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchWorkflowInstance,
  suspendWorkflow,
  resumeWorkflow,
  type WorkflowInstanceDetail,
  type WorkflowStep,
  type WorkflowStatus,
} from '../api/orchestration'

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed: 'Échoué',
  needs_arbitration: 'Arbitrage requis',
}

const STATUS_BADGE_CLASSES: Record<WorkflowStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  needs_arbitration: 'bg-yellow-100 text-yellow-700',
}

const STEP_INDICATOR_CLASSES: Record<WorkflowStatus, string> = {
  pending: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  needs_arbitration: 'bg-yellow-400',
}

function WorkflowStepRow({ step }: { step: WorkflowStep }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full mt-1 shrink-0 ${STEP_INDICATOR_CLASSES[step.status]}`}
        />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Étape {step.order} — {step.service}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{step.action}</p>
          </div>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${STATUS_BADGE_CLASSES[step.status]}`}
          >
            {STATUS_LABELS[step.status]}
          </span>
        </div>
        {step.errorMessage && (
          <p className="text-xs text-red-600 mt-1">{step.errorMessage}</p>
        )}
        {step.startedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Démarré le {new Date(step.startedAt).toLocaleString('fr-FR')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function WorkflowTimeline() {
  const { workflowInstanceId } = useParams<{ workflowInstanceId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [instanceDetail, setInstanceDetail] = useState<WorkflowInstanceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSuspending, setIsSuspending] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspendForm, setShowSuspendForm] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isTi = hasRole('technicien_informatique')
  const isRp = hasRole('responsable_pedagogique')
  const isAf = hasRole('administrateur_financier')
  const canAccess = isTi || isRp || isAf

  const loadInstance = () => {
    if (!workflowInstanceId) return
    setIsLoading(true)
    setLoadError(null)
    fetchWorkflowInstance(workflowInstanceId)
      .then((detail) => setInstanceDetail(detail))
      .catch(() => setLoadError('Impossible de charger cette instance de workflow.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!canAccess) return
    loadInstance()
  }, [workflowInstanceId, canAccess])

  const handleSuspend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!workflowInstanceId || !suspendReason.trim()) return
    setIsSuspending(true)
    setActionError(null)
    try {
      const result = await suspendWorkflow(workflowInstanceId, { reason: suspendReason })
      setInstanceDetail((previous) =>
        previous
          ? { ...previous, status: result.status, instance: { ...previous.instance, status: result.status } }
          : previous,
      )
      setShowSuspendForm(false)
      setSuspendReason('')
    } catch {
      setActionError('Impossible de suspendre le workflow.')
    } finally {
      setIsSuspending(false)
    }
  }

  const handleResume = async (overrideTi: boolean = false) => {
    if (!workflowInstanceId) return
    setIsResuming(true)
    setActionError(null)
    try {
      const result = await resumeWorkflow(workflowInstanceId, { tiOverride: overrideTi || undefined })
      setInstanceDetail((previous) =>
        previous
          ? { ...previous, status: result.status, instance: { ...previous.instance, status: result.status } }
          : previous,
      )
    } catch {
      setActionError('Impossible de reprendre le workflow.')
    } finally {
      setIsResuming(false)
    }
  }

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

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement de l'instance de workflow…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Détail du workflow</h1>
          <p className="text-red-600 text-sm">{loadError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadInstance}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/orchestration/workflows')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  if (!instanceDetail) return null

  const { instance, steps, status: currentStatus } = instanceDetail
  const canSuspend = currentStatus === 'in_progress' || currentStatus === 'pending'
  const canResume = currentStatus === 'needs_arbitration'

  return (
    <Layout>
      <div className="space-y-6">
        {/* Navigation */}
        <button
          type="button"
          onClick={() => navigate('/admin/orchestration/workflows')}
          className="text-sm text-indigo-600 hover:underline"
        >
          Retour aux workflows
        </button>

        {/* En-tête instance */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {instance.workflowType}
              </h1>
              <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                {instance.workflowInstanceId}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                correlationId :{' '}
                <span className="font-mono">{instance.correlationId}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Démarré le {new Date(instance.startedAt).toLocaleString('fr-FR')}
              </p>
            </div>
            <span
              className={`text-sm font-semibold px-3 py-1 rounded-full shrink-0 ${STATUS_BADGE_CLASSES[currentStatus]}`}
            >
              {STATUS_LABELS[currentStatus]}
            </span>
          </div>
        </div>

        {/* Erreur d'action */}
        {actionError && (
          <p className="text-red-600 text-sm">{actionError}</p>
        )}

        {/* Actions (TI / RP / AF) */}
        <div className="flex flex-wrap gap-3">
          {canSuspend && (
            <button
              type="button"
              onClick={() => setShowSuspendForm(true)}
              className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md hover:bg-yellow-100 transition-colors"
            >
              Suspendre le workflow
            </button>
          )}
          {canResume && (
            <>
              <button
                type="button"
                disabled={isResuming}
                onClick={() => handleResume(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Reprendre
              </button>
              {isTi && (
                <button
                  type="button"
                  disabled={isResuming}
                  onClick={() => handleResume(true)}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  Forcer la reprise (TI)
                </button>
              )}
            </>
          )}
        </div>

        {/* Formulaire de suspension */}
        {showSuspendForm && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-yellow-800 mb-3">
              Motif de suspension
            </h2>
            <form onSubmit={handleSuspend} className="space-y-3">
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Décrivez la raison de la suspension…"
                aria-label="Motif de suspension"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSuspending || !suspendReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  Confirmer la suspension
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuspendForm(false)
                    setSuspendReason('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Timeline des étapes */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Étapes ({steps.length})
          </h2>
          {steps.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune étape enregistrée.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-5 divide-y divide-gray-100">
              {steps.map((step) => (
                <WorkflowStepRow key={`${step.order}-${step.service}`} step={step} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
