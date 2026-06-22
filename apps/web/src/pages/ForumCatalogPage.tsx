/**
 * ForumCatalogPage — Phase 14 (community-path-service)
 *
 * Liste des forums disponibles.
 * - Tous les utilisateurs authentifiés voient les forums publiés.
 * - L'AP peut créer un forum (soumis à validation RP avant publication).
 *
 * Routes API consommées :
 *   GET  /forums
 *   POST /forums
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchForums,
  createForum,
  type Forum,
  type ForumStatus,
  type CreateForumPayload,
} from '../api/communityPath'

const STATUS_LABELS: Record<ForumStatus, string> = {
  draft: 'Brouillon',
  pending_validation: 'En attente de validation',
  published: 'Publié',
  closed: 'Fermé',
}

const STATUS_BADGE_CLASSES: Record<ForumStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_validation: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
}

export default function ForumCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [forumList, setForumList] = useState<Forum[]>([])
  const [isLoadingForums, setIsLoadingForums] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  const [newForumTitle, setNewForumTitle] = useState('')
  const [newForumDescription, setNewForumDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isAp = hasRole('animateur_pedagogique')
  const isRp = hasRole('responsable_pedagogique')
  const canCreateForum = isAp || isRp

  useEffect(() => {
    setIsLoadingForums(true)
    setLoadError(null)

    fetchForums()
      .then((forums) => setForumList(forums))
      .catch(() => setLoadError('Impossible de charger les forums.'))
      .finally(() => setIsLoadingForums(false))
  }, [])

  const handleCreateForum = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)

    const payload: CreateForumPayload = {
      title: newForumTitle.trim(),
      description: newForumDescription.trim(),
    }

    try {
      const createdForum = await createForum(payload)
      setForumList((previous) => [createdForum, ...previous])
      setShouldShowCreateForm(false)
      setNewForumTitle('')
      setNewForumDescription('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError("Vous n'êtes pas autorisé à créer un forum.")
      } else {
        setCreateError('Impossible de créer le forum. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoadingForums) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des forums…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p className="text-red-600">{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Forums</h1>
            <p className="text-gray-500 text-sm mt-1">
              Espaces d'échange de la communauté pédagogique.
            </p>
          </div>
          {canCreateForum && (
            <button
              type="button"
              onClick={() => setShouldShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Créer un forum
            </button>
          )}
        </div>

        {/* Formulaire de création */}
        {shouldShowCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer un forum</h2>
            <p className="text-sm text-gray-500">
              Le forum sera soumis à validation par un responsable pédagogique avant d'être publié.
            </p>

            <form onSubmit={handleCreateForum} className="space-y-4">
              <div>
                <label htmlFor="forum-title" className="block text-sm text-gray-700 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  id="forum-title"
                  type="text"
                  required
                  value={newForumTitle}
                  onChange={(e) => setNewForumTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label htmlFor="forum-description" className="block text-sm text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="forum-description"
                  required
                  rows={4}
                  value={newForumDescription}
                  onChange={(e) => setNewForumDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  disabled={isCreating}
                />
              </div>

              {createError && <p className="text-red-600 text-sm">{createError}</p>}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShouldShowCreateForm(false)}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Création…' : 'Créer le forum'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des forums */}
        {forumList.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun forum disponible pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {forumList.map((forum) => (
              <li key={forum.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/community/forums/${forum.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{forum.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {forum.description}
                      </p>
                      {forum.commentCount !== undefined && (
                        <p className="text-xs text-gray-400 mt-1">
                          {forum.commentCount} commentaire{forum.commentCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                        STATUS_BADGE_CLASSES[forum.status]
                      }`}
                    >
                      {STATUS_LABELS[forum.status]}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
