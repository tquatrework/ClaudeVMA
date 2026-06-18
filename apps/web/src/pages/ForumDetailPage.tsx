/**
 * ForumDetailPage — Phase 14 (community-path-service)
 *
 * Détail d'un forum : liste les commentaires et permet d'en ajouter.
 * Affiche également le panneau de modération pour les AP/RP.
 *
 * Routes API consommées :
 *   POST /forums/:id/comments
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  createForumComment,
  type ForumComment,
  type CreateForumCommentPayload,
} from '../api/communityPath'

export default function ForumDetailPage() {
  const { forumId } = useParams<{ forumId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [commentList, setCommentList] = useState<ForumComment[]>([])
  const [newCommentContent, setNewCommentContent] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const isAp = hasRole('animateur_pedagogique')
  const isRp = hasRole('responsable_pedagogique')
  const canModerate = isAp || isRp

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!forumId) return

    setIsSubmittingComment(true)
    setCommentError(null)

    const payload: CreateForumCommentPayload = {
      content: newCommentContent.trim(),
    }

    try {
      const createdComment = await createForumComment(forumId, payload)
      setCommentList((previous) => [...previous, createdComment])
      setNewCommentContent('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCommentError("Vous n'êtes pas autorisé à commenter ce forum.")
      } else {
        setCommentError('Impossible d\'envoyer le commentaire.')
      }
    } finally {
      setIsSubmittingComment(false)
    }
  }

  if (!forumId) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">Identifiant du forum manquant.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Navigation retour */}
        <button
          type="button"
          onClick={() => navigate('/community/forums')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour aux forums
        </button>

        <h1 className="text-2xl font-bold text-gray-900">Forum</h1>

        {/* Panneau de modération */}
        {canModerate && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">Modération</p>
            <p className="text-xs text-yellow-700">
              En tant qu'animateur ou responsable pédagogique, vous pouvez exclure des membres.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/community/forums/${forumId}/moderation`)}
              className="mt-2 px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors"
            >
              Ouvrir le panneau de modération
            </button>
          </div>
        )}

        {/* Liste des commentaires */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Commentaires</h2>
          {commentList.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aucun commentaire pour l'instant. Soyez le premier à contribuer !
            </p>
          ) : (
            <ul className="space-y-3">
              {commentList.map((comment) => (
                <li
                  key={comment.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <p className="text-sm text-gray-700">{comment.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Formulaire de commentaire */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Ajouter un commentaire</h2>
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <div>
              <label htmlFor="comment-content" className="block text-sm text-gray-700 mb-1">
                Votre commentaire <span className="text-red-500">*</span>
              </label>
              <textarea
                id="comment-content"
                required
                rows={4}
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                disabled={isSubmittingComment}
                placeholder="Partagez votre réflexion…"
              />
            </div>
            {commentError && <p className="text-red-600 text-sm">{commentError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingComment}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingComment ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
