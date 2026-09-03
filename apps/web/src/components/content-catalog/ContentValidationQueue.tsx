/**
 * ContentValidationQueue — Phase 12 (content-catalog-service)
 *
 * File de validation des contenus pédagogiques pour les rôles RP et AP.
 * Affiche les contenus en statut `pending_validation` et permet de les valider ou rejeter.
 * Les listes de contenus (exercices, évaluations, tutoriels, quizz) en attente sont reçues en
 * props.
 *
 * Exercices, Quizz, Évaluations et — depuis la refonte du 2026-09-03 — Tutoriels disposent tous
 * d'une vraie route de décision (même mécanisme de validation générique,
 * `docs/architecture.md` > « Refonte des Exercices »/« Refonte des Evaluations »/« Refonte des
 * Tutos/Vidéos ») : ce composant les appelle réellement via
 * `ExerciseValidationList`/`QuizValidationList`/`EvaluationValidationList`/`TutorialValidationList`.
 *
 * Note : la validation de chaque type de contenu est aussi accessible depuis l'onglet
 * « Validation » de sa propre page catalogue (leçon du chantier Quizz sur la découvrabilité) — les
 * deux écrans appellent la même route serveur, sans état partagé entre eux.
 */

import React, { useState } from 'react'
import type { Evaluation, EvaluationValidationDecision } from '../../types/evaluation'
import type { ExerciseSummary, ExerciseValidationDecision } from '../../types/exercise'
import type { QuizSummary, QuizValidationDecision } from '../../types/quiz'
import type { TutorialSummary, TutorialValidationDecision } from '../../types/tutorial'
import { ExerciseValidationList } from './ExerciseValidationList'
import { QuizValidationList } from './QuizValidationList'
import { EvaluationValidationList } from './EvaluationValidationList'
import { TutorialValidationList } from './TutorialValidationList'

interface ContentValidationQueueProps {
  pendingExercises: ExerciseSummary[]
  pendingEvaluations: Evaluation[]
  pendingTutorials: TutorialSummary[]
  pendingQuizzes: QuizSummary[]
  onDecideExercise: (
    exerciseId: string,
    decision: ExerciseValidationDecision,
    comment?: string,
  ) => Promise<void>
  onDecideQuiz: (quizId: string, decision: QuizValidationDecision, comment?: string) => Promise<void>
  onDecideEvaluation: (
    evaluationId: string,
    decision: EvaluationValidationDecision,
    comment?: string,
  ) => Promise<void>
  onDecideTutorial: (
    tutorialId: string,
    decision: TutorialValidationDecision,
    comment?: string,
  ) => Promise<void>
}

type ActiveValidationTab = 'exercises' | 'evaluations' | 'tutorials' | 'quizzes'

export default function ContentValidationQueue({
  pendingExercises,
  pendingEvaluations,
  pendingTutorials,
  pendingQuizzes,
  onDecideExercise,
  onDecideQuiz,
  onDecideEvaluation,
  onDecideTutorial,
}: ContentValidationQueueProps) {
  const [activeTab, setActiveTab] = useState<ActiveValidationTab>('exercises')

  const totalPendingCount =
    pendingExercises.length + pendingEvaluations.length + pendingTutorials.length +
    pendingQuizzes.length

  if (totalPendingCount === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucun contenu en attente de validation.</p>
      </div>
    )
  }

  const tabs: { id: ActiveValidationTab; label: string; count: number }[] = [
    { id: 'exercises', label: 'Exercices', count: pendingExercises.length },
    { id: 'evaluations', label: 'Évaluations', count: pendingEvaluations.length },
    { id: 'tutorials', label: 'Tutoriels', count: pendingTutorials.length },
    { id: 'quizzes', label: 'Quizz', count: pendingQuizzes.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">File de validation</h2>
        <span className="text-sm text-gray-500">{totalPendingCount} contenus en attente</span>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeTab === 'exercises' && (
        <ExerciseValidationList exercises={pendingExercises} onDecide={onDecideExercise} />
      )}

      {activeTab === 'evaluations' && (
        <EvaluationValidationList evaluations={pendingEvaluations} onDecide={onDecideEvaluation} />
      )}

      {activeTab === 'tutorials' && (
        <TutorialValidationList tutorials={pendingTutorials} onDecide={onDecideTutorial} />
      )}

      {activeTab === 'quizzes' && (
        <QuizValidationList quizzes={pendingQuizzes} onDecide={onDecideQuiz} />
      )}
    </div>
  )
}
