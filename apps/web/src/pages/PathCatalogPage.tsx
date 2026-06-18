/**
 * PathCatalogPage — Phase 14 (community-path-service)
 *
 * Catalogue des parcours pédagogiques.
 * - Tous les utilisateurs authentifiés voient les parcours publiés.
 * - L'AP/RP peut créer un parcours.
 * - Le RP peut valider les parcours en attente.
 * - L'élève peut s'inscrire à un parcours (max 3 actifs).
 *
 * Routes API consommées :
 *   GET  /paths
 *   POST /paths
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchPaths,
  createPath,
  type LearningPath,
  type PathStatus,
  type CreatePathPayload,
} from '../api/communityPath'

const STATUS_LABELS: Record<PathStatus, string> = {
  draft: 'Brouillon',
  pending_validation: 'En attente de validation',
  published: 'Publié',
  archived: 'Archivé',
}

const STATUS_BADGE_CLASSES: Record<PathStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_validation: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

export default function PathCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [pathList, setPathList] = useState<LearningPath[]>([])
  const [isLoadingPaths, setIsLoadingPaths] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  const [newPathTitle, setNewPathTitle] = useState('')
  const [newPathDescription, setNewPathDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isAp = hasRole('animateur_pedagogique')
  const isRp = hasRole('responsable_pedagogique')
  const canCreatePath = isAp || isRp

  useEffect(() => {
    setIsLoadingPaths(true)
    setLoadError(null)

    fetchPaths()
      .then((paths) => setPathList(paths))
      .catch(() => setLoadError('Impossible de charger les parcours.'))
      .finally(() => setIsLoadingPaths(false))
  }, [])

  const handleCreatePath = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)

    const payload: CreatePathPayload = {
      title: newPathTitle.trim(),
      description: newPathDescription.trim(),
    }

    try {
      const createdPath = await createPath(payload)
      setPathList((previous) => [createdPath, ...previous])
      setShouldShowCreateForm(false)
      setNewPathTitle('')
      setNewPathDescription('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError("Vous n'êtes pas autorisé à créer un parcours.")
      } else {
        setCreateError('Impossible de créer le parcours. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoadingPaths) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des parcours…</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Parcours pédagogiques</h1>
            <p className="text-gray-500 text-sm mt-1">
              Progressez étape par étape à travers des parcours structurés.
            </p>
          </div>
          {canCreatePath && (
            <button
              type="button"
              onClick={() => setShouldShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Créer un parcours
            </button>
          )}
        </div>

        {/* Formulaire de création */}
        {shouldShowCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer un parcours</h2>
            <p className="text-sm text-gray-500">
              Le parcours sera soumis à validation par un responsable pédagogique.
            </p>

            <form onSubmit={handleCreatePath} className="space-y-4">
              <div>
                <label htmlFor="path-title" className="block text-sm text-gray-700 mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  id="path-title"
                  type="text"
                  required
                  value={newPathTitle}
                  onChange={(e) => setNewPathTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label htmlFor="path-description" className="block text-sm text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="path-description"
                  required
                  rows={4}
                  value={newPathDescription}
                  onChange={(e) => setNewPathDescription(e.target.value)}
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
                  {isCreating ? 'Création…' : 'Créer le parcours'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des parcours */}
        {pathList.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun parcours disponible pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pathList.map((learningPath) => (
              <li key={learningPath.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/community/paths/${learningPath.id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {learningPath.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {learningPath.description}
                      </p>
                      {learningPath.stepCount !== undefined && (
                        <p className="text-xs text-gray-400 mt-1">
                          {learningPath.stepCount} étape{learningPath.stepCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                        STATUS_BADGE_CLASSES[learningPath.status]
                      }`}
                    >
                      {STATUS_LABELS[learningPath.status]}
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
