/**
 * EvaluationAttemptResumePage — reprise d'une tentative d'Évaluation déjà démarrée (accessible
 * depuis l'onglet « Mon historique », entrées `in_progress` — voir
 * `EvaluationAttemptHistoryList`). Charge la tentative existante et l'évaluation associée, puis
 * délègue au même cœur de passage que `EvaluationAttemptPage`
 * (`EvaluationAttemptSessionView`) — aucune nouvelle tentative n'est créée.
 *
 * Routes API consommées :
 *   GET /evaluation-attempts/:id   (learning-activity-service — propriétaire uniquement, 404 sinon)
 *   GET /evaluations/:id           (content-catalog-service)
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchEvaluationAttempt } from '../api/evaluationAttempts'
import { fetchEvaluation } from '../api/evaluations'
import { EvaluationAttemptSessionView } from '../components/learning-activity/EvaluationAttemptSessionView'
import type { EvaluationAttemptView } from '../types/evaluationAttempt'

export default function EvaluationAttemptResumePage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const resolvedAttemptId = attemptId ?? ''

  const {
    data: initialAttempt,
    isLoading: isLoadingAttempt,
    error: attemptError,
  } = useAsyncData(() => fetchEvaluationAttempt(resolvedAttemptId), [resolvedAttemptId], {
    fallbackErrorMessage: 'Impossible de charger cette tentative.',
  })

  const [attempt, setAttempt] = useState<EvaluationAttemptView | null>(null)
  const activeAttempt = attempt ?? initialAttempt ?? null

  const {
    data: evaluation,
    isLoading: isLoadingEvaluation,
    error: evaluationError,
  } = useAsyncData(
    () => (activeAttempt ? fetchEvaluation(activeAttempt.evaluationId) : Promise.reject(new Error('no-attempt'))),
    [activeAttempt?.evaluationId],
    { fallbackErrorMessage: 'Impossible de charger cette évaluation.' },
  )

  if (!resolvedAttemptId) {
    return (
      <Layout>
        <ErrorMessage message="Tentative introuvable." />
      </Layout>
    )
  }

  if (isLoadingAttempt || (activeAttempt && isLoadingEvaluation)) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement…</p>
      </Layout>
    )
  }

  if (attemptError || !activeAttempt) {
    return (
      <Layout>
        <ErrorMessage message={attemptError ?? 'Cette tentative est introuvable.'} />
      </Layout>
    )
  }

  if (evaluationError || !evaluation) {
    return (
      <Layout>
        <ErrorMessage message={evaluationError ?? "Cette évaluation est introuvable."} />
      </Layout>
    )
  }

  return (
    <Layout>
      <EvaluationAttemptSessionView
        evaluation={evaluation}
        attempt={activeAttempt}
        onAttemptUpdate={setAttempt}
      />
    </Layout>
  )
}
