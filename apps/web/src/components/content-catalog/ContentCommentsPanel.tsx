/**
 * ContentCommentsPanel — Phase 12 (content-catalog-service)
 *
 * Panneau d'affichage et de saisie de commentaires sur un contenu pédagogique.
 * Appelle POST /contents/:id/comments via createContentComment.
 *
 * Props :
 *   contentId — identifiant du contenu (exercice, évaluation ou tutoriel)
 *   comments  — liste des commentaires existants à afficher
 *   onCommentAdded — callback après ajout réussi d'un commentaire
 */

import React, { useState } from 'react'
import { createContentComment, type ContentComment } from '../../api/contentCatalog'

interface ContentCommentsPanelProps {
  contentId: string
  comments: ContentComment[]
  onCommentAdded: (newComment: ContentComment) => void
}

export default function ContentCommentsPanel({
  contentId,
  comments,
  onCommentAdded,
}: ContentCommentsPanelProps) {
  const [newCommentContent, setNewCommentContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newCommentContent.trim()) {
      setSubmitError('Le commentaire ne peut pas être vide.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const createdComment = await createContentComment(contentId, {
        content: newCommentContent.trim(),
      })
      setNewCommentContent('')
      onCommentAdded(createdComment)
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setSubmitError('Vous n\'êtes pas autorisé à commenter ce contenu.')
      } else {
        setSubmitError('Impossible d\'ajouter le commentaire. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCommentDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">
        Commentaires ({comments.length})
      </h3>

      {/* Liste des commentaires */}
      {comments.length === 0 ? (
        <p className="text-gray-400 text-sm italic">Aucun commentaire pour ce contenu.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-1"
            >
              <p className="text-sm text-gray-800">{comment.content}</p>
              <p className="text-xs text-gray-400">{formatCommentDate(comment.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={handleSubmitComment} className="space-y-2">
        <label htmlFor="new-comment" className="block text-sm text-gray-700">
          Ajouter un commentaire
        </label>
        <textarea
          id="new-comment"
          value={newCommentContent}
          onChange={(e) => setNewCommentContent(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
          placeholder="Partagez votre avis ou posez une question…"
          disabled={isSubmitting}
        />

        {submitError && (
          <p className="text-red-600 text-sm">{submitError}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !newCommentContent.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Envoi…' : 'Publier'}
          </button>
        </div>
      </form>
    </div>
  )
}
