/**
 * TutorialDetailPage — détail d'un Tutoriel/Vidéo : vidéo embarquée ou rendu des blocs (titre,
 * texte, image), et lien optionnel vers un Quizz à passer en fin de tutoriel.
 *
 * Pas de suivi de consultation/progression pour ce type de contenu (hors périmètre de la refonte
 * du 2026-09-03) — cet écran est un simple affichage.
 *
 * C'est aussi l'écran de destination après une édition réussie (`TutorialEditPage`), même
 * mécanisme déjà en place pour l'Exercice : un message de confirmation est porté par
 * `location.state.message`, lu ici une fois au montage.
 *
 * Routes API consommées :
 *   GET /tutorials/:id (content-catalog-service)
 */

import React from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchTutorial } from '../api/tutorials'
import { TutorialBlockView } from '../components/content-catalog/TutorialBlockView'
import {
  TUTORIAL_FORMAT_LABELS,
  TUTORIAL_STATUS_BADGE_CLASSES,
  TUTORIAL_STATUS_LABELS,
} from '../utils/tutorialLabels'

export default function TutorialDetailPage() {
  const { tutorialId } = useParams<{ tutorialId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const resolvedTutorialId = tutorialId ?? ''

  const locationState = location.state as { message?: string } | null
  const confirmationMessage = locationState?.message ?? null

  const {
    data: tutorial,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchTutorial(resolvedTutorialId), [resolvedTutorialId], {
    fallbackErrorMessage: 'Impossible de charger ce tutoriel.',
  })

  const isAuthor = !!user && !!tutorial && tutorial.authorId === user.id

  if (!resolvedTutorialId) {
    return (
      <Layout>
        <ErrorMessage message="Tutoriel introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement du tutoriel…</p>
      </Layout>
    )
  }

  if (loadError || !tutorial) {
    return (
      <Layout>
        <ErrorMessage message={loadError ?? 'Ce tutoriel est introuvable ou non accessible.'} />
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/content/tutorials')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        {confirmationMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {confirmationMessage}
          </div>
        )}

        <PageHeader
          title={tutorial.title}
          subtitle={tutorial.description ?? undefined}
          action={
            <div className="flex items-center gap-3">
              {isAuthor && (
                <button
                  type="button"
                  onClick={() => navigate(`/content/tutorials/${resolvedTutorialId}/edit`)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                >
                  Modifier le tutoriel
                </button>
              )}
              <StatusBadge
                status={tutorial.status}
                label={TUTORIAL_STATUS_LABELS[tutorial.status]}
                badgeClasses={TUTORIAL_STATUS_BADGE_CLASSES}
                size="md"
              />
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            {TUTORIAL_FORMAT_LABELS[tutorial.format]}
          </span>
          {tutorial.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          {tutorial.format === 'video' && tutorial.videoUrl && (
            <a
              href={tutorial.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Regarder la vidéo
            </a>
          )}

          {tutorial.format === 'post' && (
            <div className="space-y-4">
              {tutorial.blocks.length === 0 ? (
                <p className="text-sm text-gray-400">Ce tutoriel ne contient encore aucun contenu.</p>
              ) : (
                tutorial.blocks.map((block) => (
                  <TutorialBlockView key={block.id} tutorialId={resolvedTutorialId} block={block} />
                ))
              )}
            </div>
          )}
        </div>

        {tutorial.linkedQuizId && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-center justify-between gap-4">
            <p className="text-sm text-indigo-800">Un quizz est associé à ce tutoriel.</p>
            <button
              type="button"
              onClick={() => navigate(`/content/quizz/${tutorial.linkedQuizId}`)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shrink-0"
            >
              Passer le quizz
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
