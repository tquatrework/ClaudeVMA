/**
 * ContentValidationQueuePage — Phase 12 (content-catalog-service)
 *
 * Page de validation du catalogue pédagogique pour les rôles RP et AP.
 * Charge les contenus en statut `pending_validation` et permet de les valider ou rejeter.
 *
 * Exercices, Quizz, Évaluations et — depuis la refonte du 2026-09-03 — Tutoriels utilisent tous
 * une vraie route de décision (même mécanisme générique — `docs/architecture.md` > « Refonte des
 * Exercices »/« Refonte des Evaluations »/« Refonte des Tutos/Vidéos ») : ce composant les appelle
 * réellement.
 *
 * Routes API consommées :
 *   GET  /exercises/pending-validation        (content-catalog-service)
 *   POST /validations/exercise/:id/decision   (content-catalog-service)
 *   GET  /evaluations (large, filtré côté client — voir `api/evaluations.ts`)
 *   POST /validations/evaluation/:id/decision (content-catalog-service)
 *   GET  /tutorials/pending-validation, POST /validations/tutorial/:id/decision
 *   GET  /quizzes/pending-validation, POST /validations/quiz/:id/decision
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import ContentValidationQueue from '../components/content-catalog/ContentValidationQueue'
import { decideTutorialValidation, fetchPendingTutorials } from '../api/tutorials'
import { decideQuizValidation, fetchPendingQuizzes } from '../api/quizzes'
import { decideExerciseValidation, fetchPendingExercises } from '../api/exercises'
import { decideEvaluationValidation, fetchPendingEvaluations } from '../api/evaluations'
import type { QuizSummary, QuizValidationDecision } from '../types/quiz'
import type { ExerciseSummary, ExerciseValidationDecision } from '../types/exercise'
import type { Evaluation, EvaluationValidationDecision } from '../types/evaluation'
import type { TutorialSummary, TutorialValidationDecision } from '../types/tutorial'

export default function ContentValidationQueuePage() {
  const { hasRole } = useAuth()

  const [pendingExercises, setPendingExercises] = useState<ExerciseSummary[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([])
  const [pendingTutorials, setPendingTutorials] = useState<TutorialSummary[]>([])
  const [pendingQuizzes, setPendingQuizzes] = useState<QuizSummary[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [exerciseLoadError, setExerciseLoadError] = useState<string | null>(null)
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null)
  const [evaluationLoadError, setEvaluationLoadError] = useState<string | null>(null)
  const [tutorialLoadError, setTutorialLoadError] = useState<string | null>(null)
  const [validationFeedback, setValidationFeedback] = useState<string | null>(null)

  const canValidateContent = hasRole('responsable_pedagogique', 'animateur_pedagogique')

  useEffect(() => {
    if (!canValidateContent) {
      setIsLoadingContent(false)
      return
    }

    setIsLoadingContent(true)
    setLoadError(null)
    setExerciseLoadError(null)
    setQuizLoadError(null)
    setEvaluationLoadError(null)
    setTutorialLoadError(null)

    // Chaque type de contenu est chargé séparément : leurs routes ont des historiques différents
    // et peuvent échouer indépendamment sans priver le RP/AP des files qui, elles, fonctionnent.
    fetchPendingExercises()
      .then((exerciseResult) => setPendingExercises(exerciseResult.items))
      .catch(() => setExerciseLoadError('Impossible de charger les exercices en attente.'))
      .finally(() => setIsLoadingContent(false))

    fetchPendingQuizzes()
      .then((quizResult) => setPendingQuizzes(quizResult.items))
      .catch(() => setQuizLoadError('Impossible de charger les quizz en attente.'))

    fetchPendingEvaluations()
      .then((evaluations) => setPendingEvaluations(evaluations))
      .catch(() => setEvaluationLoadError('Impossible de charger les évaluations en attente.'))

    fetchPendingTutorials()
      .then((tutorialResult) => setPendingTutorials(tutorialResult.items))
      .catch(() => setTutorialLoadError('Impossible de charger les tutoriels en attente.'))
  }, [canValidateContent])

  const handleDecideExercise = async (
    exerciseId: string,
    decision: ExerciseValidationDecision,
    comment?: string,
  ) => {
    await decideExerciseValidation(exerciseId, decision, comment)
    setPendingExercises((previous) => previous.filter((exercise) => exercise.id !== exerciseId))
    setValidationFeedback(decision === 'validated' ? 'Exercice validé avec succès.' : 'Exercice rejeté.')
    setTimeout(() => setValidationFeedback(null), 3000)
  }

  const handleDecideQuiz = async (
    quizId: string,
    decision: QuizValidationDecision,
    comment?: string,
  ) => {
    await decideQuizValidation(quizId, decision, comment)
    setPendingQuizzes((previous) => previous.filter((quiz) => quiz.id !== quizId))
    setValidationFeedback(decision === 'validated' ? 'Quizz validé avec succès.' : 'Quizz rejeté.')
    setTimeout(() => setValidationFeedback(null), 3000)
  }

  const handleDecideEvaluation = async (
    evaluationId: string,
    decision: EvaluationValidationDecision,
    comment?: string,
  ) => {
    await decideEvaluationValidation(evaluationId, decision, comment)
    setPendingEvaluations((previous) => previous.filter((evaluation) => evaluation.id !== evaluationId))
    setValidationFeedback(
      decision === 'validated' ? 'Évaluation validée avec succès.' : 'Évaluation rejetée.',
    )
    setTimeout(() => setValidationFeedback(null), 3000)
  }

  const handleDecideTutorial = async (
    tutorialId: string,
    decision: TutorialValidationDecision,
    comment?: string,
  ) => {
    await decideTutorialValidation(tutorialId, decision, comment)
    setPendingTutorials((previous) => previous.filter((tutorial) => tutorial.id !== tutorialId))
    setValidationFeedback(decision === 'validated' ? 'Tutoriel validé avec succès.' : 'Tutoriel rejeté.')
    setTimeout(() => setValidationFeedback(null), 3000)
  }

  if (!canValidateContent) {
    return (
      <Layout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Validation des contenus</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700 text-sm">
              Accès réservé aux Responsables Pédagogiques et Animateurs Pédagogiques.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  if (isLoadingContent) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des contenus en attente…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p className="text-red-600">{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Validation des contenus</h1>
          <p className="text-gray-500 text-sm mt-1">
            Contenus pédagogiques soumis en attente de votre validation.
          </p>
        </div>

        {exerciseLoadError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-yellow-700 text-sm">{exerciseLoadError}</p>
          </div>
        )}

        {quizLoadError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-yellow-700 text-sm">{quizLoadError}</p>
          </div>
        )}

        {evaluationLoadError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-yellow-700 text-sm">{evaluationLoadError}</p>
          </div>
        )}

        {tutorialLoadError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-yellow-700 text-sm">{tutorialLoadError}</p>
          </div>
        )}

        {/* Feedback de validation */}
        {validationFeedback && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-green-700 text-sm">{validationFeedback}</p>
          </div>
        )}

        <ContentValidationQueue
          pendingExercises={pendingExercises}
          pendingEvaluations={pendingEvaluations}
          pendingTutorials={pendingTutorials}
          pendingQuizzes={pendingQuizzes}
          onDecideExercise={handleDecideExercise}
          onDecideQuiz={handleDecideQuiz}
          onDecideEvaluation={handleDecideEvaluation}
          onDecideTutorial={handleDecideTutorial}
        />
      </div>
    </Layout>
  )
}
