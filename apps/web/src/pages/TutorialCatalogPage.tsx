/**
 * TutorialCatalogPage — Phase 12 (content-catalog-service)
 *
 * Catalogue des tutoriels vidéos pédagogiques.
 * L'élève et le formateur voient les tutoriels publiés.
 * Le formateur peut créer un tutoriel.
 * Le RP/AP voit les tutoriels en attente de validation.
 *
 * Routes API consommées :
 *   GET  /tutorials
 *   POST /tutorials
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import {
  fetchTutorials,
  createTutorial,
  createContentComment,
  type Tutorial,
  type ContentComment,
} from '../api/contentCatalog'
import ContentCommentsPanel from '../components/content-catalog/ContentCommentsPanel'

export default function TutorialCatalogPage() {
  const { hasRole } = useAuth()

  const [tutorialList, setTutorialList] = useState<Tutorial[]>([])
  const [isLoadingTutorials, setIsLoadingTutorials] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null)
  const [tutorialComments, setTutorialComments] = useState<ContentComment[]>([])

  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  // Champs du formulaire de création
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newLevel, setNewLevel] = useState('')
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isTeacher = hasRole('formateur')
  const isInternalUser = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
  )
  const canCreateTutorial = isTeacher || isInternalUser

  useEffect(() => {
    setIsLoadingTutorials(true)
    setLoadError(null)

    fetchTutorials()
      .then((tutorials) => setTutorialList(tutorials))
      .catch(() => setLoadError('Impossible de charger les tutoriels.'))
      .finally(() => setIsLoadingTutorials(false))
  }, [])

  const handleSelectTutorial = (tutorial: Tutorial) => {
    setSelectedTutorial(tutorial)
    setTutorialComments([])
  }

  const handleCommentAdded = (newComment: ContentComment) => {
    setTutorialComments((previous) => [...previous, newComment])
  }

  const handleCreateTutorial = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)

    try {
      const createdTutorial = await createTutorial({
        title: newTitle.trim(),
        description: newDescription.trim(),
        subject: newSubject.trim(),
        level: newLevel.trim(),
        videoUrl: newVideoUrl.trim() || undefined,
      })

      setTutorialList((previous) => [createdTutorial, ...previous])
      setShouldShowCreateForm(false)
      setNewTitle('')
      setNewDescription('')
      setNewSubject('')
      setNewLevel('')
      setNewVideoUrl('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError('Vous n\'êtes pas autorisé à créer un tutoriel.')
      } else {
        setCreateError('Impossible de créer le tutoriel. Veuillez réessayer.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoadingTutorials) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des tutoriels…</p>
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
        <PageHeader
          title="Tutoriels vidéos"
          subtitle="Catalogue des tutoriels pédagogiques disponibles."
          action={
            canCreateTutorial ? (
              <button
                type="button"
                onClick={() => setShouldShowCreateForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Nouveau tutoriel
              </button>
            ) : undefined
          }
        />

        {/* Formulaire de création */}
        {shouldShowCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer un tutoriel</h2>

            <form onSubmit={handleCreateTutorial} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tuto-title" className="block text-sm text-gray-700 mb-1">
                    Titre <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tuto-title"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="tuto-subject" className="block text-sm text-gray-700 mb-1">
                    Matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tuto-subject"
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="tuto-level" className="block text-sm text-gray-700 mb-1">
                    Niveau <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tuto-level"
                    type="text"
                    required
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    placeholder="ex: Terminale, 3ème…"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="tuto-video-url" className="block text-sm text-gray-700 mb-1">
                    URL vidéo (optionnel)
                  </label>
                  <input
                    id="tuto-video-url"
                    type="url"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tuto-description" className="block text-sm text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="tuto-description"
                  required
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  disabled={isCreating}
                />
              </div>

              {createError && (
                <p className="text-red-600 text-sm">{createError}</p>
              )}

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
                  {isCreating ? 'Création…' : 'Créer le tutoriel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grille tutoriels + détail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des tutoriels */}
          <div>
            {tutorialList.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <EmptyState message="Aucun tutoriel disponible pour le moment." />
              </div>
            ) : (
              <ul className="space-y-3">
                {tutorialList.map((tutorial) => (
                  <li key={tutorial.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectTutorial(tutorial)}
                      className={`w-full text-left border rounded-xl p-4 transition-all ${
                        selectedTutorial?.id === tutorial.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {tutorial.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {tutorial.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {tutorial.subject}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tutorial.level}
                        </span>
                        {tutorial.status === 'pending_validation' && (
                          <StatusBadge
                            status="pending_validation"
                            label="En attente"
                            badgeClasses={{ pending_validation: 'bg-orange-100 text-orange-700' }}
                          />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Détail du tutoriel sélectionné */}
          <div>
            {selectedTutorial ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {selectedTutorial.title}
                  </h2>
                  <p className="text-sm text-gray-600 mt-2">{selectedTutorial.description}</p>
                </div>

                {selectedTutorial.videoUrl && (
                  <div>
                    <a
                      href={selectedTutorial.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Regarder le tutoriel
                    </a>
                  </div>
                )}

                {/* Commentaires */}
                <ContentCommentsPanel
                  contentId={selectedTutorial.id}
                  comments={tutorialComments}
                  onCommentAdded={handleCommentAdded}
                />
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400 text-sm">
                  Sélectionnez un tutoriel pour afficher son contenu.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
