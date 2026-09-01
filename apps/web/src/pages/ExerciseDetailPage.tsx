/**
 * ExerciseDetailPage — détail d'un Exercice : démarrage d'une tentative, passage bloc par bloc
 * (réponse facultative, révélation de solution à la demande), statut fait/en cours.
 *
 * Auto-contrôle, pas un Quizz noté — aucune notation, aucun score affiché.
 *
 * C'est aussi l'écran de destination après une édition réussie (`ExerciseEditPage`, correctif du
 * 2026-09-01 « retour à l'écran précédent avec confirmation ») : un message de confirmation est
 * porté par `location.state.message`, même mécanisme déjà en place pour l'inscription
 * (`LoginPage`/`StudentRegistrationPage`) — lu ici une fois au montage, jamais recréé côté serveur.
 *
 * Routes API consommées :
 *   GET  /exercises/:id                    (content-catalog-service)
 *   POST /exercise-attempts                (learning-activity-service — démarrage)
 *   POST /exercise-attempts/:id/answers    (learning-activity-service — réponse facultative)
 *   POST /exercise-attempts/:id/reveal     (learning-activity-service — révélation médiée)
 */

import React, { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchExercise } from '../api/exercises'
import {
  startExerciseAttempt,
  submitExerciseAttemptAnswer,
  revealExerciseAttemptSolution,
} from '../api/exerciseAttempts'
import { ExercisePlayer } from '../components/content-catalog/ExercisePlayer'
import {
  EXERCISE_ATTEMPT_STATUS_BADGE_CLASSES,
  EXERCISE_ATTEMPT_STATUS_LABELS,
  EXERCISE_STATUS_BADGE_CLASSES,
  EXERCISE_STATUS_LABELS,
  getExerciseDisplayTitle,
} from '../utils/exerciseLabels'
import { getErrorMessage } from '../utils/apiError'
import type { ExerciseAttempt } from '../types/exercise'

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const resolvedExerciseId = exerciseId ?? ''

  const locationState = location.state as { message?: string } | null
  const confirmationMessage = locationState?.message ?? null

  const {
    data: exercise,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchExercise(resolvedExerciseId), [resolvedExerciseId], {
    fallbackErrorMessage: 'Impossible de charger cet exercice.',
  })

  const [attempt, setAttempt] = useState<ExerciseAttempt | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const isAuthor = !!user && !!exercise && exercise.authorId === user.id

  const handleStart = async () => {
    if (!resolvedExerciseId) return
    setIsStarting(true)
    setStartError(null)
    try {
      const startedAttempt = await startExerciseAttempt(resolvedExerciseId)
      setAttempt(startedAttempt)
    } catch (apiError: unknown) {
      setStartError(getErrorMessage(apiError, "Impossible de démarrer cet exercice."))
    } finally {
      setIsStarting(false)
    }
  }

  const handleAnswerSubmit = async (partId: string, content: string) => {
    if (!attempt) return
    // Le serveur attend un tableau d'items texte/formule — un seul item texte couvre le cas
    // d'usage actuel (zone de réponse en texte libre). Réponse remontée telle quelle (règle du
    // 2026-08-10, point 3bis) : `submitExerciseAttemptAnswer` renvoie déjà la tentative complète.
    const updated = await submitExerciseAttemptAnswer(attempt.id, partId, [
      { type: 'text', content },
    ])
    setAttempt(updated)
  }

  const handleReveal = async (partId: string) => {
    if (!attempt) return
    // La révélation renvoie déjà la tentative complète à jour — pas de second appel nécessaire.
    const updated = await revealExerciseAttemptSolution(attempt.id, partId)
    setAttempt(updated)
  }

  if (!resolvedExerciseId) {
    return (
      <Layout>
        <ErrorMessage message="Exercice introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement de l'exercice…</p>
      </Layout>
    )
  }

  if (loadError || !exercise) {
    return (
      <Layout>
        <ErrorMessage message={loadError ?? 'Cet exercice est introuvable ou non accessible.'} />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/content/exercises')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        {confirmationMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {confirmationMessage}
          </div>
        )}

        <PageHeader
          title={getExerciseDisplayTitle(exercise.title)}
          subtitle={exercise.description ?? undefined}
          action={
            <div className="flex items-center gap-3">
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => navigate(`/content/exercises/${resolvedExerciseId}/edit`)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                >
                  Modifier l'exercice
                </button>
              )}
              <StatusBadge
                status={exercise.status}
                label={EXERCISE_STATUS_LABELS[exercise.status]}
                badgeClasses={EXERCISE_STATUS_BADGE_CLASSES}
                size="md"
              />
              {attempt && (
                <StatusBadge
                  status={attempt.status}
                  label={EXERCISE_ATTEMPT_STATUS_LABELS[attempt.status]}
                  badgeClasses={EXERCISE_ATTEMPT_STATUS_BADGE_CLASSES}
                  size="md"
                />
              )}
            </div>
          }
        />

        {exercise.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {exercise.tags.map((tag) => (
              <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {!attempt && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <p className="text-sm text-gray-600">
              {exercise.parts.length} bloc(s) — auto-contrôle : répondez à votre rythme, révélez la
              solution quand vous le souhaitez.
            </p>
            {startError && <p className="text-red-600 text-sm">{startError}</p>}
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isStarting ? 'Démarrage…' : "Commencer l'exercice"}
            </button>
          </div>
        )}

        {attempt && (
          <ExercisePlayer
            exercise={exercise}
            attempt={attempt}
            onAnswerSubmit={handleAnswerSubmit}
            onReveal={handleReveal}
          />
        )}
      </div>
    </Layout>
  )
}
