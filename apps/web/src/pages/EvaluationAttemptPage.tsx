/**
 * EvaluationAttemptPage — démarrage d'une tentative d'Évaluation (chronométrée) et passage.
 *
 * Refonte du 2026-09-02 : l'ancien écran (juin 2026, `POST /evaluations/:id/attempts`) appelait
 * une route retirée côté serveur (404 désormais — voir `docs/routes.md` > content-catalog-service
 * > « Évaluations », « Retiré le 2026-09-01 »). Ce nouvel écran suit le contrat
 * `learning-activity-service` posé le même jour (`docs/architecture.md` > « Refonte des
 * Evaluations »). Le cœur du passage (chronomètre, réponses, actions) est partagé avec
 * `EvaluationAttemptResumePage` via `EvaluationAttemptSessionView`.
 *
 * Routes API consommées :
 *   GET  /evaluations/:id           (content-catalog-service)
 *   POST /evaluation-attempts       (learning-activity-service — démarrage)
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchEvaluation } from '../api/evaluations'
import { startEvaluationAttempt } from '../api/evaluationAttempts'
import { EvaluationAttemptSessionView } from '../components/learning-activity/EvaluationAttemptSessionView'
import { getEvaluationDisplayTitle } from '../utils/evaluationLabels'
import { getErrorMessage } from '../utils/apiError'
import type { EvaluationAttemptView } from '../types/evaluationAttempt'

export default function EvaluationAttemptPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>()
  const resolvedEvaluationId = evaluationId ?? ''

  const {
    data: evaluation,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchEvaluation(resolvedEvaluationId), [resolvedEvaluationId], {
    fallbackErrorMessage: 'Impossible de charger cette évaluation.',
  })

  const [attempt, setAttempt] = useState<EvaluationAttemptView | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const handleStart = async () => {
    setIsStarting(true)
    setStartError(null)
    try {
      const startedAttempt = await startEvaluationAttempt(resolvedEvaluationId)
      setAttempt(startedAttempt)
    } catch (error: unknown) {
      setStartError(getErrorMessage(error, "Impossible de démarrer cette évaluation."))
    } finally {
      setIsStarting(false)
    }
  }

  if (!resolvedEvaluationId) {
    return (
      <Layout>
        <ErrorMessage message="Évaluation introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement de l'évaluation…</p>
      </Layout>
    )
  }

  if (loadError || !evaluation) {
    return (
      <Layout>
        <ErrorMessage message={loadError ?? 'Cette évaluation est introuvable.'} />
      </Layout>
    )
  }

  if (attempt) {
    return (
      <Layout>
        <EvaluationAttemptSessionView
          evaluation={evaluation}
          attempt={attempt}
          onAttemptUpdate={setAttempt}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getEvaluationDisplayTitle(evaluation.title)}
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            {evaluation.exerciseItems.length} exercice(s) · {Math.round(evaluation.durationSeconds / 60)}{' '}
            minutes chronométrées
          </p>
        </div>

        {evaluation.status !== 'validated' ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              Cette évaluation n'est pas encore validée — elle ne peut pas être commencée.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Une fois démarrée, vous disposerez de{' '}
              {Math.round(evaluation.durationSeconds / 60)} minutes pour répondre. Aucune solution
              n'est accessible pendant ni après le passage — la correction est faite par un
              professeur, sur demande.
            </p>
            {startError && <p className="text-red-600 text-sm">{startError}</p>}
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isStarting ? 'Démarrage…' : "Commencer l'évaluation"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
