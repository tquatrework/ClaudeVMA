/**
 * ContentValidationQueue — Phase 12 (content-catalog-service)
 *
 * File de validation des contenus pédagogiques pour les rôles RP et AP.
 * Affiche les contenus en statut `pending_validation` et permet de les valider ou rejeter.
 * Les listes de contenus (exercices, évaluations, tutoriels) en attente sont reçues en props.
 *
 * Note : les actions de validation (approve/reject) sont des commandes métier ;
 * en l'absence de routes dédiées dans la spec phase 12, ce composant affiche la file
 * et délègue les actions au parent via callbacks.
 *
 * Props :
 *   pendingExercises   — exercices en attente de validation
 *   pendingEvaluations — évaluations en attente de validation
 *   pendingTutorials   — tutoriels en attente de validation
 *   onValidateContent  — callback (contentType, id, action) appelé lors d'une décision
 */

import React, { useState } from 'react'
import type { Exercise, Evaluation, Tutorial } from '../../api/contentCatalog'
import type { QuizSummary } from '../../types/quiz'
import { QuizValidationList } from './QuizValidationList'

type ContentDecision = 'approve' | 'reject'

interface ContentValidationQueueProps {
  pendingExercises: Exercise[]
  pendingEvaluations: Evaluation[]
  pendingTutorials: Tutorial[]
  pendingQuizzes: QuizSummary[]
  onValidateContent: (
    contentType: 'exercise' | 'evaluation' | 'tutorial',
    contentId: string,
    decision: ContentDecision,
  ) => void
  onDecideQuiz: (quizId: string, decision: ContentDecision, comment?: string) => Promise<void>
}

type ActiveValidationTab = 'exercises' | 'evaluations' | 'tutorials' | 'quizzes'

export default function ContentValidationQueue({
  pendingExercises,
  pendingEvaluations,
  pendingTutorials,
  pendingQuizzes,
  onValidateContent,
  onDecideQuiz,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">File de validation</h2>
        <span className="text-sm text-gray-500">{totalPendingCount} contenus en attente</span>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('exercises')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'exercises'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Exercices ({pendingExercises.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'evaluations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Évaluations ({pendingEvaluations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tutorials')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'tutorials'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Tutoriels ({pendingTutorials.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('quizzes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'quizzes'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Quizz ({pendingQuizzes.length})
        </button>
      </div>

      {/* Contenu selon l'onglet */}
      {activeTab === 'exercises' && (
        <ValidationItemList
          items={pendingExercises}
          contentType="exercise"
          onValidate={onValidateContent}
          emptyLabel="Aucun exercice en attente."
        />
      )}

      {activeTab === 'evaluations' && (
        <ValidationItemList
          items={pendingEvaluations}
          contentType="evaluation"
          onValidate={onValidateContent}
          emptyLabel="Aucune évaluation en attente."
        />
      )}

      {activeTab === 'tutorials' && (
        <ValidationItemList
          items={pendingTutorials}
          contentType="tutorial"
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

// ─── Sous-composant liste de validation ───────────────────────────────────────

interface ValidationItem {
  id: string
  title: string
  description: string
  subject: string
  level: string
}

interface ValidationItemListProps {
  items: ValidationItem[]
  contentType: 'exercise' | 'evaluation' | 'tutorial'
  onValidate: (
    contentType: 'exercise' | 'evaluation' | 'tutorial',
    contentId: string,
    decision: ContentDecision,
  ) => void
  emptyLabel: string
}

function ValidationItemList({
  items,
  contentType,
  onValidate,
  emptyLabel,
}: ValidationItemListProps) {
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
              onClick={() => onValidate(contentType, item.id, 'approve')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
            >
              Valider
            </button>
            <button
              type="button"
              onClick={() => onValidate(contentType, item.id, 'reject')}
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
