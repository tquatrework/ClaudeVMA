/**
 * EvaluationAttemptSessionView — cœur du passage d'une Évaluation, partagé entre le démarrage
 * (`EvaluationAttemptPage`) et la reprise d'une tentative déjà en cours
 * (`EvaluationAttemptResumePage`). Chronomètre visible, zones de réponse par Exercice de la suite,
 * aucune solution accessible (arbitrage du 2026-09-01), « enregistrer ma réponse » et « demander
 * une correction » comme deux actions distinctes non couplées.
 *
 * Le blocage du retour arrière (`evaluation.blockBackNavigation`) reste une hypothèse de
 * confiance côté serveur (arbitrage du 2026-09-01, point 3 : « il est supposé ne pas changer
 * d'url non plus ») — le front se contente d'avertir avant de quitter l'onglet
 * (`beforeunload`), sans verrou de navigation interne durci.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorMessage } from '../ui/ErrorMessage'
import { StatusBadge } from '../ui/StatusBadge'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCountdownTimer } from '../../hooks/useCountdownTimer'
import { fetchExercise } from '../../api/exercises'
import {
  requestEvaluationCorrection,
  submitEvaluationAttempt,
  submitEvaluationAttemptAnswer,
} from '../../api/evaluationAttempts'
import { getErrorMessage } from '../../utils/apiError'
import {
  EVALUATION_ATTEMPT_STATUS_BADGE_CLASSES,
  EVALUATION_ATTEMPT_STATUS_LABELS,
  getEvaluationDisplayTitle,
} from '../../utils/evaluationLabels'
import { EvaluationExercisePlayer } from './EvaluationExercisePlayer'
import type { Evaluation } from '../../types/evaluation'
import type { EvaluationAttemptView } from '../../types/evaluationAttempt'
import type { PublicExerciseDetail } from '../../types/exercise'

interface EvaluationAttemptSessionViewProps {
  evaluation: Evaluation
  attempt: EvaluationAttemptView
  onAttemptUpdate: (updated: EvaluationAttemptView) => void
}

export function EvaluationAttemptSessionView({
  evaluation,
  attempt,
  onAttemptUpdate,
}: EvaluationAttemptSessionViewProps) {
  const navigate = useNavigate()
  const {
    data: exercises,
    isLoading: isLoadingExercises,
    error: exercisesError,
  } = useAsyncData(
    () =>
      Promise.all(
        [...evaluation.exerciseItems]
          .sort((a, b) => a.order - b.order)
          .map((item) => fetchExercise(item.exerciseId)),
      ),
    [evaluation.id],
    { fallbackErrorMessage: 'Impossible de charger les exercices de cette évaluation.' },
  )

  const timer = useCountdownTimer(attempt.status === 'in_progress' ? attempt.deadlineAt : null)
  const isAnswerable = attempt.status === 'in_progress' && !timer.isExpired

  const [isSubmittingAttempt, setIsSubmittingAttempt] = useState(false)
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!evaluation.blockBackNavigation || attempt.status !== 'in_progress') return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [evaluation.blockBackNavigation, attempt.status])

  const handleAnswerSubmit = async (exerciseId: string, partId: string, content: string) => {
    const updated = await submitEvaluationAttemptAnswer(attempt.id, exerciseId, partId, [
      { type: 'text', content },
    ])
    onAttemptUpdate(updated)
  }

  const handleCloseAttempt = async () => {
    setIsSubmittingAttempt(true)
    setActionError(null)
    try {
      const updated = await submitEvaluationAttempt(attempt.id)
      onAttemptUpdate(updated)
      setActionMessage('Réponse enregistrée.')
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, "Impossible d'enregistrer votre réponse."))
    } finally {
      setIsSubmittingAttempt(false)
    }
  }

  const handleRequestCorrection = async () => {
    setIsRequestingCorrection(true)
    setActionError(null)
    try {
      await requestEvaluationCorrection(attempt.id)
      setActionMessage('Demande de correction envoyée.')
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Impossible de demander une correction.'))
    } finally {
      setIsRequestingCorrection(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getEvaluationDisplayTitle(evaluation.title)}
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            {evaluation.exerciseItems.length} exercice(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {attempt.status === 'in_progress' && (
            <span
              className={`text-sm font-mono px-3 py-1 rounded-full ${
                timer.isExpired ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {timer.isExpired ? 'Temps écoulé' : timer.formatted}
            </span>
          )}
          <StatusBadge
            status={attempt.status}
            label={EVALUATION_ATTEMPT_STATUS_LABELS[attempt.status]}
            badgeClasses={EVALUATION_ATTEMPT_STATUS_BADGE_CLASSES}
            size="md"
          />
        </div>
      </div>

      {timer.isExpired && attempt.status === 'in_progress' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
          <p className="text-orange-700 text-sm">
            Le temps imparti est écoulé. Vous pouvez encore enregistrer votre réponse telle quelle.
          </p>
        </div>
      )}

      {isLoadingExercises && <p className="text-gray-400 text-sm">Chargement des exercices…</p>}
      {exercisesError && <ErrorMessage message={exercisesError} />}

      {!isLoadingExercises && !exercisesError && exercises && (
        <div className="space-y-4">
          {exercises.map((exercise: PublicExerciseDetail) => (
            <EvaluationExercisePlayer
              key={exercise.id}
              exercise={exercise}
              displayTitle={
                evaluation.exerciseItems.find((item) => item.exerciseId === exercise.id)
                  ?.titleOverride || exercise.title || 'Exercice'
              }
              answers={attempt.answers}
              isAnswerable={isAnswerable}
              onAnswerSubmit={(partId, content) => handleAnswerSubmit(exercise.id, partId, content)}
              scoring={evaluation.scoring}
            />
          ))}
        </div>
      )}

      {actionMessage && <p className="text-sm text-green-700">{actionMessage}</p>}
      {actionError && <ErrorMessage message={actionError} />}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
        {attempt.status === 'in_progress' && (
          <button
            type="button"
            onClick={handleCloseAttempt}
            disabled={isSubmittingAttempt}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmittingAttempt ? 'Enregistrement…' : 'Enregistrer ma réponse'}
          </button>
        )}
        {attempt.status === 'completed' && (
          <button
            type="button"
            onClick={handleRequestCorrection}
            disabled={isRequestingCorrection}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {isRequestingCorrection ? 'Envoi…' : 'Demander une correction'}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/content/evaluations')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Retour au catalogue
        </button>
      </div>
    </div>
  )
}
