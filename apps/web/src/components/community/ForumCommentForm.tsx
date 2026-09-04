/**
 * ForumCommentForm — saisie et publication d'un commentaire (`POST /forums/:id/comments`).
 *
 * Toujours rendu à l'intérieur de `<ForumCharterGate>` : la charte est déjà acceptée quand ce
 * formulaire est visible. Le cas `CHARTER_NOT_ACCEPTED` renvoyé malgré tout (race — acceptation
 * non retombée à temps sur un second onglet) affiche un message d'action plutôt qu'une erreur
 * générique inexploitable.
 */

import React, { useState } from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'

interface ForumCommentFormProps {
  isPosting: boolean
  postError: string | null
  charterNotAccepted: boolean
  onSubmit: (content: string) => Promise<boolean>
  onDismissError: () => void
}

export function ForumCommentForm({
  isPosting,
  postError,
  charterNotAccepted,
  onSubmit,
  onDismissError,
}: ForumCommentFormProps) {
  const [content, setContent] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    const wasPosted = await onSubmit(trimmedContent)
    if (wasPosted) setContent('')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
      <h2 className="text-base font-semibold text-gray-800">Ajouter un commentaire</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="comment-content" className="block text-sm text-gray-700 mb-1">
            Votre commentaire <span className="text-red-500">*</span>
          </label>
          <textarea
            id="comment-content"
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isPosting}
            placeholder="Partagez votre réflexion…"
          />
        </div>

        {charterNotAccepted && (
          <ErrorMessage
            variant="warning"
            message="Votre acceptation de la charte n'a pas pu être vérifiée. Rechargez la page et réessayez."
            onClose={onDismissError}
          />
        )}
        {postError && !charterNotAccepted && (
          <ErrorMessage message={postError} onClose={onDismissError} />
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPosting || content.trim().length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPosting ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  )
}
