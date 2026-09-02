/**
 * EvaluationEditPage — édition d'une Évaluation par son auteur.
 *
 * `PUT /evaluations/:id` ajoutée le 2026-09-02 (PR #203, avec le barème informatif) — aucune
 * route d'édition n'existait jusqu'ici (voir `MyEvaluationsList`, retour post-production du même
 * jour). Même patron que `QuizEditPage`/`ExerciseEditPage`.
 *
 * Routes API consommées :
 *   GET /evaluations/:id   (content-catalog-service — détail, scoring inclus)
 *   GET /exercises/:id     (content-catalog-service — titre de chaque exercice de la suite)
 *   PUT /evaluations/:id   (content-catalog-service — remplacement intégral)
 */

import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useEvaluationForEdit } from '../hooks/content-catalog/useEvaluationForEdit'
import { EvaluationForm } from '../components/content-catalog/EvaluationForm'
import { getEvaluationDisplayTitle } from '../utils/evaluationLabels'

export default function EvaluationEditPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>()
  const navigate = useNavigate()
  const resolvedEvaluationId = evaluationId ?? ''

  const {
    data: loadResult,
    isLoading,
    error: loadError,
  } = useEvaluationForEdit(resolvedEvaluationId)

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

  if (loadError || !loadResult) {
    return (
      <Layout>
        <ErrorMessage
          message={
            loadError ?? "Cette évaluation est introuvable ou vous n'êtes pas autorisé à la modifier."
          }
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/content/evaluations')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        <PageHeader
          title="Modifier l'évaluation"
          subtitle={getEvaluationDisplayTitle(loadResult.evaluation.title)}
        />

        <EvaluationForm
          mode="edit"
          evaluationId={resolvedEvaluationId}
          initialDraft={loadResult.initialState}
          onSaved={() => navigate('/content/evaluations')}
          onCancel={() => navigate('/content/evaluations')}
        />
      </div>
    </Layout>
  )
}
