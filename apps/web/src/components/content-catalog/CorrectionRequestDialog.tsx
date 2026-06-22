/**
 * CorrectionRequestDialog — Phase 12 (content-catalog-service)
 *
 * Dialog permettant à un élève de demander une correction sur une réponse soumise.
 * Appelle POST /exercise-answers/:id/correction-requests via requestExerciseCorrection.
 *
 * Props :
 *   answerId — identifiant de la réponse pour laquelle demander une correction
 *   isOpen   — contrôle l'affichage du dialog
 *   onClose  — callback de fermeture
 *   onCorrectionRequested — callback après demande réussie
 */

import React, { useState } from 'react'
import { requestExerciseCorrection } from '../../api/contentCatalog'

interface CorrectionRequestDialogProps {
  answerId: string
  isOpen: boolean
  onClose: () => void
  onCorrectionRequested: () => void
}

export default function CorrectionRequestDialog({
  answerId,
  isOpen,
  onClose,
  onCorrectionRequested,
}: CorrectionRequestDialogProps) {
  const [messageContent, setMessageContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await requestExerciseCorrection(answerId, {
        message: messageContent.trim() || undefined,
      })
      onCorrectionRequested()
      onClose()
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 409) {
        setSubmitError('Une demande de correction est déjà en cours pour cette réponse.')
      } else if (responseStatus === 403) {
        setSubmitError('Vous n\'êtes pas autorisé à demander une correction.')
      } else {
        setSubmitError('Impossible de soumettre la demande de correction. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setMessageContent('')
    setSubmitError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-dialog-title"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
        <h2 id="correction-dialog-title" className="text-lg font-semibold text-gray-900">
          Demander une correction
        </h2>
        <p className="text-sm text-gray-500">
          Un formateur examinera votre réponse et vous fournira un retour.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="correction-message" className="block text-sm text-gray-700 mb-1">
              Message (optionnel)
            </label>
            <textarea
              id="correction-message"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
              placeholder="Précisez vos difficultés ou questions…"
              disabled={isSubmitting}
            />
          </div>

          {submitError && (
            <p className="text-red-600 text-sm">{submitError}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
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
              {isSubmitting ? 'Envoi…' : 'Demander la correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
