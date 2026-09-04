/**
 * ForumTopicCreateForm — saisie et création d'un sujet (`POST /forums/:id/topics`, `{title,
 * content}`). Toujours rendu à l'intérieur de `<ForumCharterGate>` par la page appelante : la
 * charte est déjà acceptée quand ce formulaire est visible. Le cas `CHARTER_NOT_ACCEPTED` renvoyé
 * malgré tout (race — acceptation non retombée à temps sur un second onglet) affiche un message
 * d'action plutôt qu'une erreur générique inexploitable, même discipline que `ForumCommentForm`.
 */

import React, { useState } from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'
import { FORUM_LABELS } from '../../utils/forumLabels'

interface ForumTopicCreateFormProps {
  isCreating: boolean
  createError: string | null
  charterNotAccepted: boolean
  onSubmit: (payload: { title: string; content: string }) => Promise<boolean>
  onDismissError: () => void
  onCancel: () => void
}

export function ForumTopicCreateForm({
  isCreating,
  createError,
  charterNotAccepted,
  onSubmit,
  onDismissError,
  onCancel,
}: ForumTopicCreateFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    if (!trimmedTitle || !trimmedContent) return

    const wasCreated = await onSubmit({ title: trimmedTitle, content: trimmedContent })
    if (wasCreated) {
      setTitle('')
      setContent('')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
      <h2 className="text-base font-semibold text-gray-800">{FORUM_LABELS.newTopicTitle}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="topic-title" className="block text-sm text-gray-700 mb-1">
            {FORUM_LABELS.topicTitleLabel} <span className="text-red-500">*</span>
          </label>
          <input
            id="topic-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isCreating}
          />
        </div>

        <div>
          <label htmlFor="topic-content" className="block text-sm text-gray-700 mb-1">
            {FORUM_LABELS.topicFirstMessageLabel} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="topic-content"
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isCreating}
          />
        </div>

        {charterNotAccepted && (
          <ErrorMessage
            variant="warning"
            message="Votre acceptation de la charte n'a pas pu être vérifiée. Rechargez la page et réessayez."
            onClose={onDismissError}
          />
        )}
        {createError && !charterNotAccepted && (
          <ErrorMessage message={createError} onClose={onDismissError} />
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isCreating || title.trim().length === 0 || content.trim().length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? FORUM_LABELS.creatingTopic : FORUM_LABELS.createTopicSubmit}
          </button>
        </div>
      </form>
    </div>
  )
}
