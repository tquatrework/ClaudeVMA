/**
 * ForumDetailPage — community-path-service
 *
 * Refonte du 2026-09-04 (« Sujets (topics) des Forums ») : l'écran devient une **liste de sujets**,
 * plus un fil de commentaires direct. `POST`/`GET`/`DELETE /forums/:id/comments` n'existent plus —
 * un commentaire appartient désormais à un sujet (`ForumTopic`). Un clic sur un sujet ouvre
 * `ForumTopicDetailPage` (`/community/forums/:forumId/topics/:topicId`), qui porte le fil de
 * discussion.
 *
 * Un forum inexistant ou restreint pour le rôle courant répond 404 dans les deux cas
 * (masquage total, `docs/routes.md` § « Masquage total ») : cet écran ne distingue jamais les deux
 * causes, il affiche un même message neutre.
 *
 * Routes API consommées :
 *   GET    /forums/:id
 *   GET    /forums/:id/topics
 *   POST   /forums/:id/topics                 (tout membre ayant accepté la charte)
 *   POST   /forums/:id/image                  (RP uniquement)
 *   POST   /forums/:id/hide                   (RP uniquement)
 *   PATCH  /forums/:id                        (RP uniquement — édition des métadonnées)
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useForumDetail } from '../hooks/community/useForumDetail'
import { useForumTopics } from '../hooks/community/useForumTopics'
import { useForumHide } from '../hooks/community/useForumHide'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { ForumThumbnail } from '../components/community/ForumThumbnail'
import { ForumImageUploader } from '../components/community/ForumImageUploader'
import { ForumCreateForm } from '../components/community/ForumCreateForm'
import { ForumCharterGate } from '../components/community/ForumCharterGate'
import { ForumTopicList } from '../components/community/ForumTopicList'
import { ForumTopicCreateForm } from '../components/community/ForumTopicCreateForm'
import { formatAllowedRolesLabel, FORUM_LABELS } from '../utils/forumLabels'
import type { ForumTopic } from '../types/forum'

export default function ForumDetailPage() {
  const { forumId } = useParams<{ forumId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const isRp = hasRole('responsable_pedagogique')

  const { forum, isLoading, isNotFound, error, setForum } = useForumDetail(forumId)
  const {
    topics,
    isLoading: isLoadingTopics,
    loadError: topicsLoadError,
    page,
    totalPages,
    setPage,
    isCreating,
    createError,
    charterNotAccepted,
    createTopic,
    dismissCreateError,
  } = useForumTopics(forumId)
  const { isHiding, hideError, hide } = useForumHide()
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [isNewTopicFormOpen, setIsNewTopicFormOpen] = useState(false)

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

  const handleHideForum = async () => {
    if (!window.confirm(FORUM_LABELS.hideForumConfirm)) return
    const updatedForum = await hide(forum.id)
    if (updatedForum) setForum(updatedForum)
  }

  const handleSelectTopic = (topic: ForumTopic) => {
    navigate(`/community/forums/${forum.id}/topics/${topic.id}`)
  }

  const handleTopicCreated = async (payload: { title: string; content: string }): Promise<boolean> => {
    const createdTopic = await createTopic(payload)
    if (!createdTopic) return false
    setIsNewTopicFormOpen(false)
    navigate(`/community/forums/${forum.id}/topics/${createdTopic.id}`)
    return true
  }

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
          {forum.isHidden && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
              {FORUM_LABELS.hiddenBadge}
            </span>
          )}
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

        {isRp && !isEditFormOpen && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">Modération</p>
            <p className="text-xs text-yellow-700">
              En tant que responsable pédagogique, vous pouvez modifier ce forum, exclure des
              membres{!forum.isHidden && ' ou le cacher à tous'}.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsEditFormOpen(true)}
                className="px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors"
              >
                {FORUM_LABELS.editForum}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/community/forums/${forum.id}/moderation`)}
                className="px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200 transition-colors"
              >
                Ouvrir le panneau de modération
              </button>
              {!forum.isHidden && (
                <button
                  type="button"
                  onClick={() => void handleHideForum()}
                  disabled={isHiding}
                  className="px-3 py-1 text-xs font-medium text-red-800 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isHiding ? FORUM_LABELS.hidingForum : FORUM_LABELS.hideForum}
                </button>
              )}
            </div>
            {hideError && <p className="text-xs text-red-600 mt-2">{hideError}</p>}
            {forum.isHidden && (
              <p className="text-xs text-red-700 mt-2">{FORUM_LABELS.hiddenNotice}</p>
            )}
          </div>
        )}

        {isRp && isEditFormOpen && (
          <ForumCreateForm
            forum={forum}
            onUpdated={(updatedForum) => {
              setForum(updatedForum)
              setIsEditFormOpen(false)
            }}
            onCancel={() => setIsEditFormOpen(false)}
          />
        )}

        <ForumCharterGate>
          {!isNewTopicFormOpen ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsNewTopicFormOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                {FORUM_LABELS.newTopicButton}
              </button>
            </div>
          ) : (
            <ForumTopicCreateForm
              isCreating={isCreating}
              createError={createError}
              charterNotAccepted={charterNotAccepted}
              onSubmit={handleTopicCreated}
              onDismissError={dismissCreateError}
              onCancel={() => setIsNewTopicFormOpen(false)}
            />
          )}
        </ForumCharterGate>

        <ForumTopicList
          topics={topics}
          isLoading={isLoadingTopics}
          loadError={topicsLoadError}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onSelect={handleSelectTopic}
        />
      </div>
    </Layout>
  )
}
