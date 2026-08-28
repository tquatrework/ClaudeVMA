/**
 * QuizCreateForm — création complète d'un Quizz (content-catalog-service).
 *
 * Formulaire majoritairement auto-porté (état local) : une liste dynamique de questions,
 * chacune avec sa propre forme selon sa catégorie, ne se prête pas au découpage
 * "props contrôlées par la page" utilisé pour les formulaires plus simples du projet
 * (`ExerciseCreateForm`) sans le rendre illisible — voir la règle du projet sur les wizards
 * fortement couplés.
 *
 * Rôles autorisés à créer un Quizz : formateur, animateur_pedagogique, responsable_pedagogique
 * (statut initial `pending_validation` pour un formateur, `validated` — auto-validé — pour AP/RP).
 */

import React, { useState } from 'react'
import { createQuiz } from '../../api/quizzes'
import { getErrorMessage } from '../../utils/apiError'
import { buildQuizCreatePayload } from '../../utils/quizPayload'
import type { CreateQuizPayload, PublicQuizDetail } from '../../types/quiz'
import {
  QuizQuestionEditor,
  createEditableQuestion,
  type EditableQuizQuestion,
} from './QuizQuestionEditor'

interface QuizCreateFormProps {
  onCreated: (quiz: PublicQuizDetail) => void
  onCancel: () => void
}

export function QuizCreateForm({ onCreated, onCancel }: QuizCreateFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [defaultPoints, setDefaultPoints] = useState('1')
  const [penaltyEnabled, setPenaltyEnabled] = useState(false)
  const [penaltyPoints, setPenaltyPoints] = useState('')
  const [questions, setQuestions] = useState<EditableQuizQuestion[]>([createEditableQuestion()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const updateQuestion = (localId: string, updated: EditableQuizQuestion) => {
    setQuestions((previous) => previous.map((q) => (q.localId === localId ? updated : q)))
  }

  const removeQuestion = (localId: string) => {
    setQuestions((previous) => previous.filter((q) => q.localId !== localId))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    let payload: CreateQuizPayload
    try {
      payload = buildQuizCreatePayload(
        title,
        description,
        tagsInput,
        defaultPoints,
        penaltyEnabled,
        penaltyPoints,
        questions,
      )
    } catch (validationError: unknown) {
      setFormError(
        validationError instanceof Error ? validationError.message : 'Formulaire invalide.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createQuiz(payload)
      onCreated(created)
    } catch (apiError: unknown) {
      setFormError(getErrorMessage(apiError, 'Impossible de créer le quizz.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Créer un Quizz</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quiz-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="quiz-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="quiz-tags" className="block text-sm text-gray-700 mb-1">
              Tags de recherche (séparés par des virgules)
            </label>
            <input
              id="quiz-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="fractions, géométrie"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="quiz-description" className="block text-sm text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="quiz-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div>
            <label htmlFor="quiz-default-points" className="block text-xs text-gray-600 mb-1">
              Barème par défaut (points/question)
            </label>
            <input
              id="quiz-default-points"
              type="number"
              min={0}
              step="0.5"
              value={defaultPoints}
              onChange={(e) => setDefaultPoints(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 mt-5">
              <input
                type="checkbox"
                checked={penaltyEnabled}
                onChange={(e) => setPenaltyEnabled(e.target.checked)}
                disabled={isSubmitting}
              />
              Pénalité globale sur réponse fausse
            </label>
          </div>
          {penaltyEnabled && (
            <div>
              <label htmlFor="quiz-penalty-points" className="block text-xs text-gray-600 mb-1">
                Points de pénalité
              </label>
              <input
                id="quiz-penalty-points"
                type="number"
                min={0}
                step="0.5"
                value={penaltyPoints}
                onChange={(e) => setPenaltyPoints(e.target.value)}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Questions</h3>
          {questions.map((question, index) => (
            <QuizQuestionEditor
              key={question.localId}
              index={index}
              question={question}
              isSubmitting={isSubmitting}
              onChange={(updated) => updateQuestion(question.localId, updated)}
              onRemove={() => removeQuestion(question.localId)}
            />
          ))}
          <button
            type="button"
            onClick={() => setQuestions((previous) => [...previous, createEditableQuestion()])}
            disabled={isSubmitting}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Ajouter une question
          </button>
        </div>

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Création…' : 'Créer le Quizz'}
          </button>
        </div>
      </form>
    </div>
  )
}
