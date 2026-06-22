/**
 * ExerciseAnswerUpload — Phase 12 (content-catalog-service)
 *
 * Formulaire permettant à un élève de soumettre une réponse à un exercice.
 * Appelle POST /exercises/:id/answers via submitExerciseAnswer.
 *
 * Props :
 *   exerciseId — identifiant de l'exercice cible
 *   onAnswerSubmitted — callback déclenché après soumission réussie avec l'answerId
 */

import React, { useState } from 'react'
import { submitExerciseAnswer, type ExerciseAnswer } from '../../api/contentCatalog'

interface ExerciseAnswerUploadProps {
  exerciseId: string
  onAnswerSubmitted: (answer: ExerciseAnswer) => void
}

export default function ExerciseAnswerUpload({
  exerciseId,
  onAnswerSubmitted,
}: ExerciseAnswerUploadProps) {
  const [answerContent, setAnswerContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!answerContent.trim()) {
      setSubmitError('La réponse ne peut pas être vide.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const submittedAnswer = await submitExerciseAnswer(exerciseId, {
        content: answerContent.trim(),
      })
      setHasSubmitted(true)
      onAnswerSubmitted(submittedAnswer)
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setSubmitError('Vous n\'êtes pas autorisé à soumettre une réponse à cet exercice.')
      } else if (responseStatus === 404) {
        setSubmitError('Exercice introuvable.')
      } else {
        setSubmitError('Impossible de soumettre la réponse. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (hasSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-700 text-sm font-medium">
          Réponse soumise avec succès.
        </p>
        <p className="text-green-600 text-sm mt-1">
          Vous pouvez désormais demander une correction.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Soumettre votre réponse</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="answer-content" className="block text-sm text-gray-700 mb-1">
            Votre réponse
          </label>
          <textarea
            id="answer-content"
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
            placeholder="Rédigez votre réponse ici…"
            disabled={isSubmitting}
          />
        </div>

        {submitError && (
          <p className="text-red-600 text-sm">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !answerContent.trim()}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Envoi en cours…' : 'Soumettre la réponse'}
        </button>
      </form>
    </div>
  )
}
