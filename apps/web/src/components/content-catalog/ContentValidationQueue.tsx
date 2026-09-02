/**
 * ContentValidationQueue — Phase 12 (content-catalog-service)
 *
 * File de validation des contenus pédagogiques pour les rôles RP et AP.
 * Affiche les contenus en statut `pending_validation` et permet de les valider ou rejeter.
 * Les listes de contenus (exercices, évaluations, tutoriels, quizz) en attente sont reçues en
 * props.
 *
 * Exercices, Quizz et Évaluations disposent d'une vraie route de décision (même mécanisme de
 * validation générique, `docs/architecture.md` > « Refonte des Exercices »/« Refonte des
 * Evaluations ») — ce composant l'appelle réellement via
 * `ExerciseValidationList`/`QuizValidationList`/`EvaluationValidationList`. Seuls les tutoriels
 * restent en attente d'une route dédiée (validation encore optimiste côté client).
 *
 * Note : la validation des Évaluations est aussi accessible depuis l'onglet « Validation » de
 * `EvaluationCatalogPage` (leçon du chantier Quizz sur la découvrabilité) — les deux écrans
 * appellent la même route serveur, sans état partagé entre eux.
 */

import React, { useState } from 'react'
import type { Tutorial } from '../../api/contentCatalog'
import type { Evaluation, EvaluationValidationDecision } from '../../types/evaluation'
import type { ExerciseSummary, ExerciseValidationDecision } from '../../types/exercise'
import type { QuizSummary, QuizValidationDecision } from '../../types/quiz'
import { ExerciseValidationList } from './ExerciseValidationList'
import { QuizValidationList } from './QuizValidationList'
import { EvaluationValidationList } from './EvaluationValidationList'

// Vocabulaire local, propre aux tutoriels (validation encore optimiste côté client, aucune route
// de décision documentée pour ce type). Distinct de `ExerciseValidationDecision`/
// `QuizValidationDecision`/`EvaluationValidationDecision`, qui portent le vocabulaire réel attendu
// par le serveur.
type ContentDecision = 'approve' | 'reject'

interface ContentValidationQueueProps {
  pendingExercises: ExerciseSummary[]
  pendingEvaluations: Evaluation[]
  pendingTutorials: Tutorial[]
  pendingQuizzes: QuizSummary[]
  onValidateContent: (contentType: 'tutorial', contentId: string, decision: ContentDecision) => void
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
}

type ActiveValidationTab = 'exercises' | 'evaluations' | 'tutorials' | 'quizzes'

export default function ContentValidationQueue({
  pendingExercises,
  pendingEvaluations,
  pendingTutorials,
  pendingQuizzes,
  onValidateContent,
  onDecideExercise,
  onDecideQuiz,
  onDecideEvaluation,
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
        <ValidationItemList
          items={pendingTutorials}
          onValidate={onValidateContent}
          emptyLabel="Aucun tutoriel en attente."
        />
      )}

      {activeTab === 'quizzes' && (
        <QuizValidationList quizzes={pendingQuizzes} onDecide={onDecideQuiz} />
      )}
    </div>
  )
}

// ─── Sous-composant liste de validation (tutoriels) ────────────────────────────

interface ValidationItem {
  id: string
  title: string
  description: string
  subject: string
  level: string
}

interface ValidationItemListProps {
  items: ValidationItem[]
  onValidate: (contentType: 'tutorial', contentId: string, decision: ContentDecision) => void
  emptyLabel: string
}

function ValidationItemList({ items, onValidate, emptyLabel }: ValidationItemListProps) {
  if (items.length === 0) {
    return <p className="text-gray-400 text-sm italic py-4">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {item.subject}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {item.level}
              </span>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onValidate('tutorial', item.id, 'approve')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => onValidate('tutorial', item.id, 'reject')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            >
              Rejeter
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
