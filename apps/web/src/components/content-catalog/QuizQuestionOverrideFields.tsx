/**
 * QuizQuestionOverrideFields — barème/pénalité spécifiques à une question, extrait de
 * `QuizQuestionEditor` (dépassement du seuil de 300 lignes du projet).
 */

import React from 'react'
import type { EditableQuizQuestion } from './QuizQuestionEditor'

interface QuizQuestionOverrideFieldsProps {
  question: EditableQuizQuestion
  isSubmitting: boolean
  onUpdate: (patch: Partial<EditableQuizQuestion>) => void
}

export function QuizQuestionOverrideFields({
  question,
  isSubmitting,
  onUpdate,
}: QuizQuestionOverrideFieldsProps) {
  return (
    <div className="pt-1 border-t border-gray-200">
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={question.hasOverride}
          onChange={(e) => onUpdate({ hasOverride: e.target.checked })}
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
              onChange={(e) => onUpdate({ pointsOverrideInput: e.target.value })}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 mt-5">
              <input
                type="checkbox"
                checked={question.penaltyEnabledOverride}
                onChange={(e) => onUpdate({ penaltyEnabledOverride: e.target.checked })}
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
                onChange={(e) => onUpdate({ penaltyPointsOverrideInput: e.target.value })}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
