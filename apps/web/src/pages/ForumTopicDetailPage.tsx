/**
 * ForumTopicDetailPage — community-path-service
 *
 * Détail d'un sujet (`ForumTopic`), ajouté le 2026-09-04 (« Sujets (topics) des Forums ») : porte
 * le fil de discussion qui vivait auparavant directement sur `ForumDetailPage`. Un sujet
 * inexistant ou non visible à l'appelant (en attente/refusé, consulté par un tiers non autorisé)
 * répond 404 dans les deux cas (masquage total) : cet écran ne distingue jamais les deux causes.
 *
 * Un sujet `pending_validation`/`rejected` reste visible à son auteur et aux administrateurs
 * (RP/AF/TI) — badge de statut explicite, jamais présenté comme un sujet validé. Le RP dispose en
 * plus des actions de décision (`POST /forums/:id/topics/:topicId/decision`), aucun scoping AP ici
 * (à la différence du contenu pédagogique générique de `content-catalog-service`).
 *
 * Routes API consommées :
 *   GET    /forums/:id/topics/:topicId
 *   POST   /forums/:id/topics/:topicId/decision      (RP uniquement)
 *   GET    /forums/:id/topics/:topicId/comments
 *   POST   /forums/:id/topics/:topicId/comments
 *   DELETE /forums/:id/topics/:topicId/comments/:commentId  (RP uniquement)
 */

import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useForumTopicDetail } from '../hooks/community/useForumTopicDetail'
import { useTopicComments } from '../hooks/community/useTopicComments'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { ForumCharterGate } from '../components/community/ForumCharterGate'
import { ForumCommentForm } from '../components/community/ForumCommentForm'
import { ForumCommentList } from '../components/community/ForumCommentList'
import { FORUM_LABELS, formatTopicStatusLabel } from '../utils/forumLabels'

export default function ForumTopicDetailPage() {
  const { forumId, topicId } = useParams<{ forumId: string; topicId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const isRp = hasRole('responsable_pedagogique')

  const { topic, isLoading, isNotFound, error, isDeciding, decideError, decide } =
    useForumTopicDetail(forumId, topicId)
  const {
    comments,
    isLoading: isLoadingComments,
    loadError: commentsLoadError,
    page,
    totalPages,
    setPage,
    isPosting,
    postError,
    charterNotAccepted,
    postComment,
    dismissPostError,
    deletingCommentId,
    deleteError,
    deleteComment,
  } = useTopicComments(forumId, topicId)

  if (!forumId || !topicId) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">Identifiant du forum ou du sujet manquant.</p>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement du sujet…</p>
      </Layout>
    )
  }

  if (isNotFound) {
    return (
      <Layout>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate(`/community/forums/${forumId}`)}
            className="text-sm text-indigo-600 hover:underline"
          >
            {FORUM_LABELS.backToTopics}
          </button>
          <p className="text-gray-600 text-sm">{FORUM_LABELS.notFoundTopic}</p>
        </div>
      </Layout>
    )
  }

  if (error || !topic) {
    return (
      <Layout>
        <ErrorMessage message={error ?? FORUM_LABELS.loadTopicError} />
      </Layout>
    )
  }

  const statusLabel = formatTopicStatusLabel(topic.status)
  const canDecide = isRp && !topic.isDefault && topic.status === 'pending_validation'

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate(`/community/forums/${forumId}`)}
          className="text-sm text-indigo-600 hover:underline"
        >
          {FORUM_LABELS.backToTopics}
        </button>

        <PageHeader title={topic.title} />

        {statusLabel && (
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
              topic.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {statusLabel}
          </span>
        )}

        {topic.status === 'rejected' && topic.rejectionReason && (
          <p className="text-sm text-red-700">Motif du refus : {topic.rejectionReason}</p>
        )}

        {canDecide && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800">
              {FORUM_LABELS.pendingTopicsModerationTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void decide('validated')}
                disabled={isDeciding}
                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeciding ? FORUM_LABELS.validatingTopic : FORUM_LABELS.validateTopic}
              </button>
              <button
                type="button"
                onClick={() => void decide('rejected')}
                disabled={isDeciding}
                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeciding ? FORUM_LABELS.rejectingTopic : FORUM_LABELS.rejectTopic}
              </button>
            </div>
            {decideError && <p className="text-xs text-red-600">{decideError}</p>}
          </div>
        )}

        <ForumCommentList
          comments={comments}
          isLoading={isLoadingComments}
          loadError={commentsLoadError}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          canDelete={isRp}
          deletingCommentId={deletingCommentId}
          deleteError={deleteError}
          onDelete={(commentId) => void deleteComment(commentId)}
        />

        <ForumCharterGate>
          <ForumCommentForm
            isPosting={isPosting}
            postError={postError}
            charterNotAccepted={charterNotAccepted}
            onSubmit={postComment}
            onDismissError={dismissPostError}
          />
        </ForumCharterGate>
      </div>
    </Layout>
  )
}
