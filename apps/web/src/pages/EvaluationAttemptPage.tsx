/**
 * EvaluationAttemptPage — Phase 12 (content-catalog-service)
 *
 * Page de tentative d'évaluation pour l'élève.
 * L'élève répond à l'évaluation et ne peut pas voir la solution avant de terminer.
 * Après soumission, une demande de correction peut être faite via learning-activity-service
 * (mocké en phase 12 — cf. spec allowedMocksUntilDependenciesExist).
 *
 * Règle métier clé : la solution reste bloquée tant que l'évaluation n'est pas complétée.
 *
 * Routes API consommées :
 *   POST /evaluations/:id/attempts
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { startEvaluationAttempt, type EvaluationAttempt } from '../api/contentCatalog'

type AttemptStage = 'not_started' | 'in_progress' | 'completed'

export default function EvaluationAttemptPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>()
  const { hasRole } = useAuth()

  const [attemptStage, setAttemptStage] = useState<AttemptStage>('not_started')
  const [answersContent, setAnswersContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [completedAttempt, setCompletedAttempt] = useState<EvaluationAttempt | null>(null)

  const isStudent = hasRole('eleve')
  const resolvedEvaluationId = evaluationId ?? ''

  const handleStartAttempt = () => {
    setAttemptStage('in_progress')
  }

  const handleSubmitAttempt = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!answersContent.trim()) {
      setSubmitError('Veuillez rédiger vos réponses avant de soumettre.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const attempt = await startEvaluationAttempt(resolvedEvaluationId, {
        answers: answersContent.trim(),
      })
      setCompletedAttempt(attempt)
      setAttemptStage('completed')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setSubmitError('Vous n\'êtes pas autorisé à passer cette évaluation.')
      } else if (responseStatus === 409) {
        setSubmitError('Une tentative est déjà en cours pour cette évaluation.')
      } else {
        setSubmitError('Impossible de soumettre l\'évaluation. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!resolvedEvaluationId) {
    return (
      <Layout>
        <p className="text-red-600">Évaluation introuvable.</p>
      </Layout>
    )
  }

  if (!isStudent) {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Tentative d'évaluation</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              Seuls les élèves peuvent passer une évaluation.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Évaluation</h1>
          <p className="text-gray-400 text-xs mt-1 font-mono">#{resolvedEvaluationId}</p>
        </div>

        {/* Phase : non démarrée */}
        {attemptStage === 'not_started' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Vous êtes sur le point de démarrer cette évaluation. Une fois commencée, vous devrez
              la compléter avant de pouvoir accéder à la solution.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-yellow-700 text-sm font-medium">
                La solution sera débloquée uniquement après soumission de vos réponses.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartAttempt}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Commencer l'évaluation
            </button>
          </div>
        )}

        {/* Phase : en cours */}
        {attemptStage === 'in_progress' && (
          <form onSubmit={handleSubmitAttempt} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-blue-700 text-sm">
                Évaluation en cours. Rédigez vos réponses ci-dessous.
              </p>
            </div>

            <div>
              <label htmlFor="evaluation-answers" className="block text-sm text-gray-700 mb-1">
                Vos réponses <span className="text-red-500">*</span>
              </label>
              <textarea
                id="evaluation-answers"
                value={answersContent}
                onChange={(e) => setAnswersContent(e.target.value)}
                rows={12}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                placeholder="Rédigez vos réponses ici…"
                disabled={isSubmitting}
              />
            </div>

            {/* Blocage solution en cours d'évaluation */}
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg px-4 py-3">
              <p className="text-gray-400 text-sm">
                Solution bloquée — disponible après soumission.
              </p>
            </div>

            {submitError && (
              <p className="text-red-600 text-sm">{submitError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !answersContent.trim()}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Soumission…' : 'Soumettre l\'évaluation'}
              </button>
            </div>
          </form>
        )}

        {/* Phase : complétée */}
        {attemptStage === 'completed' && completedAttempt && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm font-medium">
                Évaluation soumise avec succès.
              </p>
              {completedAttempt.score !== undefined && (
                <p className="text-green-600 text-sm mt-1">
                  Score obtenu : <strong>{completedAttempt.score}</strong>
                </p>
              )}
            </div>

            {/* Solution débloquée */}
            {completedAttempt.isSolutionUnlocked && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <h2 className="text-sm font-semibold text-gray-800">Solution</h2>
                <p className="text-sm text-gray-600">
                  La solution est désormais accessible. Consultez votre formateur ou le RP pour
                  obtenir un retour détaillé.
                </p>
              </div>
            )}

            {!completedAttempt.isSolutionUnlocked && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-gray-500 text-sm">
                  La solution sera disponible après correction par un formateur.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
