/**
 * ForumCommentList — fil de discussion paginé (`GET /forums/:id/comments`), du plus ancien au
 * plus récent. Bouton de suppression visible uniquement pour le responsable pédagogique
 * (`DELETE /forums/:id/comments/:commentId`, réservé au RP côté serveur).
 *
 * Chaque commentaire affiche son auteur (`authorName`, ajouté le 2026-09-04) — « Auteur inconnu »
 * si non résolu, jamais `authorId`.
 */

import React from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'
import { EmptyState } from '../ui/EmptyState'
import { FORUM_LABELS, formatForumAuthorLabel } from '../../utils/forumLabels'
import type { ForumComment } from '../../types/forum'

interface ForumCommentListProps {
  comments: ForumComment[]
  isLoading: boolean
  loadError: string | null
  page: number
  totalPages: number
  onPageChange: (nextPage: number) => void
  canDelete: boolean
  deletingCommentId: string | null
  deleteError: string | null
  onDelete: (commentId: string) => void
}

export function ForumCommentList({
  comments,
  isLoading,
  loadError,
  page,
  totalPages,
  onPageChange,
  canDelete,
  deletingCommentId,
  deleteError,
  onDelete,
}: ForumCommentListProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-800">Commentaires</h2>

      {isLoading && <p className="text-sm text-gray-400">Chargement des commentaires…</p>}
      {loadError && <ErrorMessage message={loadError} />}
      {deleteError && <ErrorMessage message={deleteError} />}

      {!isLoading && !loadError && comments.length === 0 && (
        <EmptyState message={FORUM_LABELS.emptyComments} />
      )}

      {!isLoading && comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(FORUM_LABELS.deleteCommentConfirm)) onDelete(comment.id)
                    }}
                    disabled={deletingCommentId === comment.id}
                    className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deletingCommentId === comment.id ? 'Suppression…' : FORUM_LABELS.deleteComment}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {FORUM_LABELS.authorPrefix} {formatForumAuthorLabel(comment.authorName)} ·{' '}
                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-md disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-md disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  )
}
