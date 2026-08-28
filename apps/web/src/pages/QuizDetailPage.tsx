/**
 * QuizDetailPage — détail d'un Quizz : démarrage d'une tentative, passage question par
 * question selon leur catégorie, soumission et affichage du score obtenu.
 *
 * Routes API consommées :
 *   GET  /quizzes/:id             (content-catalog-service)
 *   POST /quiz-attempts           (learning-activity-service — démarrage)
 *   POST /quiz-attempts/:id/submit (learning-activity-service — passage)
 */

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchQuiz } from '../api/quizzes'
import { startQuizAttempt, submitQuizAttempt } from '../api/quizAttempts'
import { QuizPlayer } from '../components/content-catalog/QuizPlayer'
import { QUIZ_STATUS_BADGE_CLASSES, QUIZ_STATUS_LABELS } from '../utils/quizLabels'
import { getErrorMessage } from '../utils/apiError'
import type { QuizAnswerPayload, QuizAttempt } from '../types/quiz'

export default function QuizDetailPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const resolvedQuizId = quizId ?? ''

  const {
    data: quiz,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchQuiz(resolvedQuizId), [resolvedQuizId], {
    fallbackErrorMessage: 'Impossible de charger ce quizz.',
  })

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<QuizAttempt | null>(null)

  const canAttempt = hasRole(
    'eleve',
    'formateur',
    'responsable_pedagogique',
    'animateur_pedagogique',
  )

  const handleStart = async () => {
    if (!resolvedQuizId) return
    setIsStarting(true)
    setStartError(null)
    try {
      const startedAttempt = await startQuizAttempt(resolvedQuizId)
      setAttempt(startedAttempt)
    } catch (apiError: unknown) {
      setStartError(getErrorMessage(apiError, 'Impossible de démarrer ce quizz.'))
    } finally {
      setIsStarting(false)
    }
  }

  const handleSubmit = async (answers: QuizAnswerPayload[]) => {
    if (!attempt) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const gradedAttempt = await submitQuizAttempt(attempt.id, answers)
      setResult(gradedAttempt)
    } catch (apiError: unknown) {
      setSubmitError(getErrorMessage(apiError, 'Impossible de soumettre vos réponses.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!resolvedQuizId) {
    return (
      <Layout>
        <ErrorMessage message="Quizz introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement du quizz…</p>
      </Layout>
    )
  }

  if (loadError || !quiz) {
    return (
      <Layout>
        <ErrorMessage message={loadError ?? 'Ce quizz est introuvable ou non accessible.'} />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/content/quizz')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        <PageHeader
          title={quiz.title}
          subtitle={quiz.description}
          action={
            <StatusBadge
              status={quiz.status}
              label={QUIZ_STATUS_LABELS[quiz.status]}
              badgeClasses={QUIZ_STATUS_BADGE_CLASSES}
              size="md"
            />
          }
        />

        {quiz.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quiz.tags.map((tag) => (
              <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {!canAttempt && (
          <ErrorMessage
            variant="warning"
            message="Votre rôle ne permet pas de passer ce quizz."
          />
        )}

        {canAttempt && !attempt && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-sm text-gray-600">
              {quiz.questions.length} question(s) — barème par défaut {quiz.defaultPoints} point(s)
              par question
              {quiz.penaltyEnabled ? `, pénalité de ${quiz.penaltyPoints} point(s) sur erreur.` : '.'}
            </p>
            {startError && <p className="text-red-600 text-sm">{startError}</p>}
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isStarting ? 'Démarrage…' : 'Commencer le quizz'}
            </button>
          </div>
        )}

        {attempt && (
          <QuizPlayer
            quiz={quiz}
            isSubmitting={isSubmitting}
            submitError={submitError}
            result={result}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Layout>
  )
}
