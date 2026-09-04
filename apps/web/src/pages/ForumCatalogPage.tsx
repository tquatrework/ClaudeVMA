/**
 * ForumCatalogPage — community-path-service
 *
 * Refonte du 2026-09-04 (`docs/routes.md` > « community-path-service »). Remplace intégralement
 * l'ancien écran (création AP, statut de publication `draft`/`pending_validation`/`published`/
 * `closed`, sans image ni charte ni restriction par rôle) : seul le RP crée désormais un forum,
 * visible immédiatement, avec image d'illustration, métadonnées pédagogiques, restriction
 * optionnelle par catégorie de rôle et charte de bonne conduite.
 *
 * Routes API consommées :
 *   GET  /forums                (recherche par tags, et par `mine` — onglet « Mes forums »)
 *   POST /forums                (création — RP uniquement)
 *   POST /forums/:id/image      (illustration, juste après création — RP uniquement)
 *
 * Onglet « Mes forums » (RP uniquement, complément du 2026-09-04) : seul moyen de retrouver un
 * forum caché (`POST /forums/:id/hide`, action disponible depuis `ForumDetailPage`) — `GET /forums`
 * sans `mine=true` ne les renvoie jamais.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'
import { CatalogItemCard } from '../components/ui/CatalogItemCard'
import { ForumCreateForm } from '../components/community/ForumCreateForm'
import { ForumImageUploader } from '../components/community/ForumImageUploader'
import { ForumThumbnail } from '../components/community/ForumThumbnail'
import { fetchForums } from '../api/forums'
import { formatAllowedRolesLabel, FORUM_LABELS } from '../utils/forumLabels'
import type { Forum } from '../types/forum'

export default function ForumCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const canCreateForum = hasRole('responsable_pedagogique')

  const [tagFilter, setTagFilter] = useState('')
  const [appliedTagFilter, setAppliedTagFilter] = useState('')
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [justCreatedForum, setJustCreatedForum] = useState<Forum | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all')

  const {
    data: forumList,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(
    () =>
      fetchForums({
        tags: appliedTagFilter || undefined,
        mine: viewMode === 'mine' ? true : undefined,
      }),
    [appliedTagFilter, viewMode],
    { fallbackErrorMessage: FORUM_LABELS.loadError },
  )

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setAppliedTagFilter(tagFilter.trim())
  }

  const handleForumCreated = (createdForum: Forum) => {
    setJustCreatedForum(createdForum)
    setIsCreateFormOpen(false)
    refetch()
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Forums"
          subtitle="Espaces d'échange de la communauté pédagogique."
          action={
            canCreateForum &&
            !isCreateFormOpen && (
              <button
                type="button"
                onClick={() => {
                  setJustCreatedForum(null)
                  setIsCreateFormOpen(true)
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                {FORUM_LABELS.createButton}
              </button>
            )
          }
        />

        {canCreateForum && isCreateFormOpen && (
          <ForumCreateForm onCreated={handleForumCreated} onCancel={() => setIsCreateFormOpen(false)} />
        )}

        {justCreatedForum && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
            <p className="text-sm text-green-800">
              Forum « {justCreatedForum.title} » créé avec succès. Vous pouvez lui ajouter une image
              d'illustration.
            </p>
            <ForumImageUploader
              forumId={justCreatedForum.id}
              hasImage={Boolean(justCreatedForum.imageFilename)}
              onUploaded={(updatedForum) => setJustCreatedForum(updatedForum)}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/community/forums/${justCreatedForum.id}`)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Voir le forum
              </button>
              <button
                type="button"
                onClick={() => setJustCreatedForum(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {canCreateForum && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {FORUM_LABELS.allForumsTab}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'mine'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {FORUM_LABELS.myForumsTab}
            </button>
          </div>
        )}

        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Rechercher par tag…"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Rechercher
          </button>
        </form>

        {isLoading && <p className="text-gray-400 text-sm">Chargement des forums…</p>}
        {loadError && <ErrorMessage message={loadError} />}

        {!isLoading && !loadError && (forumList?.length ?? 0) === 0 && (
          <EmptyState
            message={viewMode === 'mine' ? FORUM_LABELS.emptyMine : FORUM_LABELS.emptyList}
          />
        )}

        {!isLoading && !loadError && forumList && forumList.length > 0 && (
          <ul className="space-y-3">
            {forumList.map((forum) => (
              <CatalogItemCard
                key={forum.id}
                id={forum.id}
                title={forum.title}
                description={forum.description ?? undefined}
                onSelect={() => navigate(`/community/forums/${forum.id}`)}
                leadingVisual={
                  <ForumThumbnail forumId={forum.id} hasImage={Boolean(forum.imageFilename)} />
                }
                tags={[
                  ...(forum.tags
                    ? forum.tags.split(',').map((tag) => ({ label: tag.trim() }))
                    : []),
                ]}
                rightBadge={
                  <>
                    {forum.isHidden && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
                        {FORUM_LABELS.hiddenBadge}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        forum.allowedRoles && forum.allowedRoles.length > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {formatAllowedRolesLabel(forum.allowedRoles)}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
