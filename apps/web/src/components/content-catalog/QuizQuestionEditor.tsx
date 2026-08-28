/**
 * QuizQuestionEditor — édition d'une question au sein de `QuizCreateForm`.
 *
 * Une question porte sa catégorie (choix unique / choix multiples / texte court), son énoncé,
 * ses options ou mots-clés, son mode de notation, et d'éventuels barème/pénalité individuels qui
 * prévalent sur le réglage global du quizz (`docs/architecture.md` > « Fonctionnalite Quizz »).
 */

import React from 'react'
import { QUIZ_QUESTION_CATEGORY_LABELS } from '../../utils/quizLabels'
import type {
  MultipleChoiceScoringMode,
  QuizQuestionCategory,
  ShortTextScoringMode,
} from '../../types/quiz'

export interface EditableQuizOption {
  localId: string
  text: string
  isCorrect: boolean
}

export interface EditableQuizQuestion {
  localId: string
  category: QuizQuestionCategory
  prompt: string
  options: EditableQuizOption[]
  keywordsInput: string
  multipleChoiceScoringMode: MultipleChoiceScoringMode
  shortTextScoringMode: ShortTextScoringMode
  hasOverride: boolean
  pointsOverrideInput: string
  penaltyEnabledOverride: boolean
  penaltyPointsOverrideInput: string
}

let optionCounter = 0
export function createEditableOption(): EditableQuizOption {
  optionCounter += 1
  return { localId: `opt-${optionCounter}`, text: '', isCorrect: false }
}

let questionCounter = 0
export function createEditableQuestion(): EditableQuizQuestion {
  questionCounter += 1
  return {
    localId: `q-${questionCounter}`,
    category: 'single_choice',
    prompt: '',
    options: [createEditableOption(), createEditableOption()],
    keywordsInput: '',
    multipleChoiceScoringMode: 'all_or_nothing',
    shortTextScoringMode: 'all_or_nothing',
    hasOverride: false,
    pointsOverrideInput: '',
    penaltyEnabledOverride: false,
    penaltyPointsOverrideInput: '',
  }
}

interface QuizQuestionEditorProps {
  index: number
  question: EditableQuizQuestion
  isSubmitting: boolean
  onChange: (updated: EditableQuizQuestion) => void
  onRemove: () => void
}

export function QuizQuestionEditor({
  index,
  question,
  isSubmitting,
  onChange,
  onRemove,
}: QuizQuestionEditorProps) {
  const update = (patch: Partial<EditableQuizQuestion>) => onChange({ ...question, ...patch })

  const updateOption = (localId: string, patch: Partial<EditableQuizOption>) => {
    update({
      options: question.options.map((option) =>
        option.localId === localId ? { ...option, ...patch } : option,
      ),
    })
  }

  const toggleSingleCorrect = (localId: string) => {
    update({
      options: question.options.map((option) => ({
        ...option,
        isCorrect: option.localId === localId,
      })),
    })
  }

  const isChoiceCategory = question.category === 'single_choice' || question.category === 'multiple_choice'

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">Question {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          disabled={isSubmitting}
          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Catégorie</label>
          <select
            value={question.category}
            onChange={(e) => update({ category: e.target.value as QuizQuestionCategory })}
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            {Object.entries(QUIZ_QUESTION_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {question.category === 'multiple_choice' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notation</label>
            <select
              value={question.multipleChoiceScoringMode}
              onChange={(e) =>
                update({ multipleChoiceScoringMode: e.target.value as MultipleChoiceScoringMode })
              }
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="all_or_nothing">Note unique (tout ou rien)</option>
              <option value="per_option">Notée case par case</option>
            </select>
          </div>
        )}

        {question.category === 'short_text' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Notation</label>
            <select
              value={question.shortTextScoringMode}
              onChange={(e) =>
                update({ shortTextScoringMode: e.target.value as ShortTextScoringMode })
              }
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="all_or_nothing">Note unique</option>
              <option value="per_keyword">Notée par mot-clé</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${question.localId}-prompt`} className="block text-xs text-gray-600 mb-1">
          Énoncé <span className="text-red-500">*</span>
        </label>
        <textarea
          id={`${question.localId}-prompt`}
          value={question.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={2}
          disabled={isSubmitting}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-y"
        />
      </div>

      {isChoiceCategory && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-600">
            Options — cochez la ou les bonnes réponses
          </label>
          {question.options.map((option) => (
            <div key={option.localId} className="flex items-center gap-2">
              <input
                type={question.category === 'single_choice' ? 'radio' : 'checkbox'}
                name={`correct-${question.localId}`}
                checked={option.isCorrect}
                disabled={isSubmitting}
                onChange={() =>
                  question.category === 'single_choice'
                    ? toggleSingleCorrect(option.localId)
                    : updateOption(option.localId, { isCorrect: !option.isCorrect })
                }
              />
              <input
                type="text"
                value={option.text}
                onChange={(e) => updateOption(option.localId, { text: e.target.value })}
                placeholder="Texte de l'option"
                disabled={isSubmitting}
                className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  update({ options: question.options.filter((o) => o.localId !== option.localId) })
                }
                disabled={isSubmitting || question.options.length <= 2}
                className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update({ options: [...question.options, createEditableOption()] })}
            disabled={isSubmitting}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            + Ajouter une option
          </button>
        </div>
      )}

      {question.category === 'short_text' && (
        <div>
          <label htmlFor={`${question.localId}-keywords`} className="block text-xs text-gray-600 mb-1">
            Mots-clés attendus (séparés par des virgules)
          </label>
          <input
            id={`${question.localId}-keywords`}
            type="text"
            value={question.keywordsInput}
            onChange={(e) => update({ keywordsInput: e.target.value })}
            placeholder="paris, capitale"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
      )}

      <div className="pt-1 border-t border-gray-200">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={question.hasOverride}
            onChange={(e) => update({ hasOverride: e.target.checked })}
            disabled={isSubmitting}
          />
          Fixer un barème/pénalité spécifique à cette question (prévaut sur le réglage global)
        </label>

        {question.hasOverride && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Points</label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={question.pointsOverrideInput}
                onChange={(e) => update({ pointsOverrideInput: e.target.value })}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs text-gray-600 mt-5">
                <input
                  type="checkbox"
                  checked={question.penaltyEnabledOverride}
                  onChange={(e) => update({ penaltyEnabledOverride: e.target.checked })}
                  disabled={isSubmitting}
                />
                Pénalité si erreur
              </label>
            </div>
            {question.penaltyEnabledOverride && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Points de pénalité</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={question.penaltyPointsOverrideInput}
                  onChange={(e) => update({ penaltyPointsOverrideInput: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
