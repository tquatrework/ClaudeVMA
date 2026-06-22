/**
 * ExerciseDetailPage — Phase 12 (content-catalog-service)
 *
 * Détail d'un exercice pédagogique.
 * L'élève peut soumettre une réponse et demander une correction.
 * Le formateur/RP/AP voit la solution et peut en créer une.
 *
 * Routes API consommées :
 *   POST /exercises/:id/answers           — soumission de réponse (élève)
 *   POST /exercise-answers/:id/correction-requests — demande de correction (élève)
 *   POST /exercises/:id/solutions         — création de solution (formateur/RP/AP)
 *   POST /contents/:id/comments           — commentaires
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import ExerciseAnswerUpload from '../components/content-catalog/ExerciseAnswerUpload'
import CorrectionRequestDialog from '../components/content-catalog/CorrectionRequestDialog'
import ContentCommentsPanel from '../components/content-catalog/ContentCommentsPanel'
import {
  createExerciseSolution,
  type ExerciseAnswer,
  type ContentComment,
} from '../api/contentCatalog'

// En phase 12, les détails de l'exercice sont affichés depuis la navigation
// (la page catalog passe les données via le state de la route, ou une prochaine
// extension pourra ajouter GET /exercises/:id quand la route sera spécifiée).
// Pour l'instant la page récupère l'id depuis les params et affiche ce qui est disponible.

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const { hasRole } = useAuth()

  const [submittedAnswer, setSubmittedAnswer] = useState<ExerciseAnswer | null>(null)
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false)
  const [hasCorrectionRequested, setHasCorrectionRequested] = useState(false)
  const [comments, setComments] = useState<ContentComment[]>([])

  // Solution creation (formateur/RP/AP)
  const [solutionContent, setSolutionContent] = useState('')
  const [isCreatingSolution, setIsCreatingSolution] = useState(false)
  const [solutionError, setSolutionError] = useState<string | null>(null)
  const [solutionCreated, setSolutionCreated] = useState(false)

  const isStudent = hasRole('eleve')
  const canManageSolution = hasRole('formateur', 'responsable_pedagogique', 'animateur_pedagogique')

  const resolvedExerciseId = exerciseId ?? ''

  const handleAnswerSubmitted = (answer: ExerciseAnswer) => {
    setSubmittedAnswer(answer)
  }

  const handleCorrectionRequested = () => {
    setHasCorrectionRequested(true)
    setIsCorrectionDialogOpen(false)
  }

  const handleCommentAdded = (newComment: ContentComment) => {
    setComments((previous) => [...previous, newComment])
  }

  const handleCreateSolution = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!solutionContent.trim()) {
      setSolutionError('Le contenu de la solution ne peut pas être vide.')
      return
    }
    setIsCreatingSolution(true)
    setSolutionError(null)
    try {
      await createExerciseSolution(resolvedExerciseId, { content: solutionContent.trim() })
      setSolutionCreated(true)
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 409) {
        setSolutionError('Une solution existe déjà pour cet exercice.')
      } else {
        setSolutionError('Impossible de créer la solution.')
      }
    } finally {
      setIsCreatingSolution(false)
    }
  }

  if (!resolvedExerciseId) {
    return (
      <Layout>
        <p className="text-red-600">Exercice introuvable.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Détail de l'exercice</h1>
          <p className="text-gray-400 text-xs mt-1 font-mono">#{resolvedExerciseId}</p>
        </div>

        {/* Section réponse élève */}
        {isStudent && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Votre réponse</h2>

            {!submittedAnswer ? (
              <ExerciseAnswerUpload
                exerciseId={resolvedExerciseId}
                onAnswerSubmitted={handleAnswerSubmitted}
              />
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 text-sm font-medium">Réponse soumise.</p>
                  <p className="text-green-600 text-sm mt-1 line-clamp-3">
                    {submittedAnswer.content}
                  </p>
                </div>

                {!hasCorrectionRequested ? (
                  <button
                    type="button"
                    onClick={() => setIsCorrectionDialogOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Demander une correction
                  </button>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-blue-700 text-sm">
                      Demande de correction envoyée. Un formateur vous répondra prochainement.
                    </p>
                  </div>
                )}

                <CorrectionRequestDialog
                  answerId={submittedAnswer.id}
                  isOpen={isCorrectionDialogOpen}
                  onClose={() => setIsCorrectionDialogOpen(false)}
                  onCorrectionRequested={handleCorrectionRequested}
                />
              </div>
            )}
          </div>
        )}

        {/* Section solution — formateur/RP/AP */}
        {canManageSolution && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Solution</h2>

            {solutionCreated ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 text-sm font-medium">Solution créée avec succès.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateSolution} className="space-y-3">
                <div>
                  <label htmlFor="solution-content" className="block text-sm text-gray-700 mb-1">
                    Contenu de la solution
                    <span className="ml-1 text-xs text-gray-400">(non visible par l'élève)</span>
                  </label>
                  <textarea
                    id="solution-content"
                    value={solutionContent}
                    onChange={(e) => setSolutionContent(e.target.value)}
                    rows={6}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    placeholder="Rédigez ou complétez la solution…"
                    disabled={isCreatingSolution}
                  />
                </div>
                {solutionError && (
                  <p className="text-red-600 text-sm">{solutionError}</p>
                )}
                <button
                  type="submit"
                  disabled={isCreatingSolution || !solutionContent.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingSolution ? 'Enregistrement…' : 'Enregistrer la solution'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Section commentaires */}
        <div>
          <ContentCommentsPanel
            contentId={resolvedExerciseId}
            comments={comments}
            onCommentAdded={handleCommentAdded}
          />
        </div>
      </div>
    </Layout>
  )
}
