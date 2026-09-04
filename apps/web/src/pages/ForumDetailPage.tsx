/**
 * ForumDetailPage — community-path-service
 *
 * Refonte du 2026-09-04. `GET /forums/:id` et `GET /forums/:id/comments` sont de vraies routes
 * depuis cette date — l'ancien écran ne les appelait pas du tout (fil de discussion purement
 * local, jamais rechargé, jamais persisté entre deux visites).
 *
 * Un forum inexistant ou restreint pour le rôle courant répond 404 dans les deux cas
 * (masquage total, `docs/routes.md` § « Masquage total ») : cet écran ne distingue jamais les deux
 * causes, il affiche un même message neutre.
 *
 * Routes API consommées :
 *   GET    /forums/:id
 *   GET    /forums/:id/comments
 *   POST   /forums/:id/comments
 *   DELETE /forums/:id/comments/:commentId  (RP uniquement)
 *   POST   /forums/:id/image                (RP uniquement)
 */

import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useForumDetail } from '../hooks/community/useForumDetail'
import { useForumComments } from '../hooks/community/useForumComments'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { ForumThumbnail } from '../components/community/ForumThumbnail'
import { ForumImageUploader } from '../components/community/ForumImageUploader'
import { ForumCharterGate } from '../components/community/ForumCharterGate'
import { ForumCommentForm } from '../components/community/ForumCommentForm'
import { ForumCommentList } from '../components/community/ForumCommentList'
import { formatAllowedRolesLabel, FORUM_LABELS } from '../utils/forumLabels'

export default function ForumDetailPage() {
  const { forumId } = useParams<{ forumId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const isRp = hasRole('responsable_pedagogique')

  const { forum, isLoading, isNotFound, error, setForum } = useForumDetail(forumId)
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
  } = useForumComments(forumId)

  if (!forumId) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">Identifiant du forum manquant.</p>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement du forum…</p>
      </Layout>
    )
  }

  if (isNotFound) {
    return (
      <Layout>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/community/forums')}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Retour aux forums
          </button>
          <p className="text-gray-600 text-sm">{FORUM_LABELS.notFound}</p>
        </div>
      </Layout>
    )
  }

  if (error || !forum) {
    return (
      <Layout>
        <ErrorMessage message={error ?? FORUM_LABELS.loadError} />
      </Layout>
    )
  }

  const tagList = forum.tags
    ? forum.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : []

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/community/forums')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour aux forums
        </button>

        <ForumThumbnail forumId={forum.id} hasImage={Boolean(forum.imageFilename)} size="large" />

        <PageHeader title={forum.title} subtitle={forum.description ?? undefined} />

        <div className="flex flex-wrap gap-2">
          {forum.level && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              Niveau : {forum.level}
            </span>
          )}
          {forum.difficulty && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              Difficulté : {forum.difficulty}
            </span>
          )}
          {forum.theme && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              Thème : {forum.theme}
            </span>
          )}
          {forum.competences && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              Compétences : {forum.competences}
            </span>
          )}
          {tagList.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
              #{tag}
            </span>
          ))}
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              forum.allowedRoles && forum.allowedRoles.length > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {formatAllowedRolesLabel(forum.allowedRoles)}
          </span>
        </div>

        {isRp && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Image d'illustration</p>
            <ForumImageUploader
              forumId={forum.id}
              hasImage={Boolean(forum.imageFilename)}
              onUploaded={(updatedForum) => setForum(updatedForum)}
            />
          </div>
        )}

        {isRp && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">Modération</p>
            <p className="text-xs text-yellow-700">
              En tant que responsable pédagogique, vous pouvez exclure des membres de ce forum.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/community/forums/${forum.id}/moderation`)}
              className="mt-2 px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors"
            >
              Ouvrir le panneau de modération
            </button>
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
