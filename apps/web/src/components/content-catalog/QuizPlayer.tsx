/**
 * QuizPlayer — passage d'un Quizz : une question à la fois selon sa catégorie
 * (radio pour choix unique, cases à cocher pour choix multiples, texte libre pour texte court),
 * puis soumission et affichage du résultat noté.
 */

import React, { useState } from 'react'
import type { PublicQuizDetail, QuizAnswerPayload, QuizAttempt } from '../../types/quiz'
import { formatQuizScore } from '../../utils/quizLabels'

interface QuizPlayerProps {
  quiz: PublicQuizDetail
  isSubmitting: boolean
  submitError: string | null
  result: QuizAttempt | null
  onSubmit: (answers: QuizAnswerPayload[]) => void
}

export function QuizPlayer({ quiz, isSubmitting, submitError, result, onSubmit }: QuizPlayerProps) {
  const [singleOrMultipleAnswers, setSingleOrMultipleAnswers] = useState<Record<string, string[]>>(
    {},
  )
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})

  if (result) {
    return <QuizResult quiz={quiz} result={result} />
  }

  const toggleSingleChoice = (questionId: string, optionId: string) => {
    setSingleOrMultipleAnswers((previous) => ({ ...previous, [questionId]: [optionId] }))
  }

  const toggleMultipleChoice = (questionId: string, optionId: string) => {
    setSingleOrMultipleAnswers((previous) => {
      const current = previous[questionId] ?? []
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      return { ...previous, [questionId]: next }
    })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const answers: QuizAnswerPayload[] = quiz.questions.map((question) => {
      if (question.category === 'short_text') {
        return { questionId: question.id, text: textAnswers[question.id] ?? '' }
      }
      return { questionId: question.id, selectedOptionIds: singleOrMultipleAnswers[question.id] ?? [] }
    })
    onSubmit(answers)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {quiz.questions.map((question, index) => (
        <div key={question.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">
            {index + 1}. {question.prompt}
          </p>

          {question.category === 'single_choice' && (
            <div className="space-y-2">
              {question.options?.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    checked={(singleOrMultipleAnswers[question.id] ?? []).includes(option.id)}
                    onChange={() => toggleSingleChoice(question.id, option.id)}
                    disabled={isSubmitting}
                  />
                  {option.text}
                </label>
              ))}
            </div>
          )}

          {question.category === 'multiple_choice' && (
            <div className="space-y-2">
              {question.options?.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={(singleOrMultipleAnswers[question.id] ?? []).includes(option.id)}
                    onChange={() => toggleMultipleChoice(question.id, option.id)}
                    disabled={isSubmitting}
                  />
                  {option.text}
                </label>
              ))}
            </div>
          )}

          {question.category === 'short_text' && (
            <input
              type="text"
              value={textAnswers[question.id] ?? ''}
              onChange={(e) =>
                setTextAnswers((previous) => ({ ...previous, [question.id]: e.target.value }))
              }
              placeholder="Votre réponse…"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          )}
        </div>
      ))}

      {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Envoi…' : 'Soumettre mes réponses'}
      </button>
    </form>
  )
}

function QuizResult({ quiz, result }: { quiz: PublicQuizDetail; result: QuizAttempt }) {
  const detailsByQuestionId = new Map((result.details ?? []).map((d) => [d.questionId, d]))

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
        <p className="text-sm text-indigo-700">Score obtenu</p>
        <p className="text-3xl font-bold text-indigo-900">
          {formatQuizScore(result.score)} / {formatQuizScore(result.maxScore)}
        </p>
      </div>

      <div className="space-y-3">
        {quiz.questions.map((question, index) => {
          const detail = detailsByQuestionId.get(question.id)
          return (
            <div
              key={question.id}
              className={`border rounded-lg p-3 ${
                detail?.isCorrect
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <p className="text-sm font-medium text-gray-800">
                {index + 1}. {question.prompt}
              </p>
              {detail && (
                <p className="text-xs mt-1 text-gray-600">
                  {detail.isCorrect ? 'Correct' : 'Incorrect'} — {formatQuizScore(detail.pointsEarned)}
                  {' '}/ {formatQuizScore(detail.pointsPossible)} point(s)
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
