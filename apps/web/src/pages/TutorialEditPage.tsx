/**
 * TutorialEditPage — édition d'un Tutoriel par son auteur (métadonnées, format, blocs et images,
 * en une seule soumission de formulaire). Même patron que `ExerciseEditPage`.
 *
 * Un enregistrement réussi redirige vers la fiche du tutoriel, avec un message de confirmation
 * porté par `location.state` (même mécanisme déjà en place pour l'Exercice/l'inscription).
 *
 * Routes API consommées :
 *   GET /tutorials/:id (content-catalog-service)
 *   PUT /tutorials/:id (content-catalog-service — remplace intégralement le tutoriel)
 */

import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchTutorial } from '../api/tutorials'
import { buildEditableStateForTutorialEdit } from '../utils/tutorialPayload'
import { TutorialForm } from '../components/content-catalog/TutorialForm'

export default function TutorialEditPage() {
  const { tutorialId } = useParams<{ tutorialId: string }>()
  const navigate = useNavigate()
  const resolvedTutorialId = tutorialId ?? ''

  const {
    data: tutorial,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchTutorial(resolvedTutorialId), [resolvedTutorialId], {
    fallbackErrorMessage: 'Impossible de charger ce tutoriel pour modification.',
  })

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
        <ErrorMessage
          message={
            loadError ?? "Ce tutoriel est introuvable ou vous n'êtes pas autorisé à le modifier."
          }
        />
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

        <PageHeader title="Modifier le tutoriel" subtitle={tutorial.title} />

        <TutorialForm
          mode="edit"
          tutorialId={resolvedTutorialId}
          initialState={buildEditableStateForTutorialEdit(tutorial)}
          onSaved={() =>
            navigate(`/content/tutorials/${resolvedTutorialId}`, {
              state: { message: 'Modifications enregistrées.' },
            })
          }
          onCancel={() => navigate(`/content/tutorials/${resolvedTutorialId}`)}
        />
      </div>
    </Layout>
  )
}
