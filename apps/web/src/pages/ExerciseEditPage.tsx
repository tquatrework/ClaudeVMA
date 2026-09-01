/**
 * ExerciseEditPage — édition d'un Exercice par son auteur, et gestion de ses images.
 *
 * ⚠️ `content-catalog-service` n'expose aucune route publique renvoyant le contenu d'une solution
 * à l'auteur (contrairement au Quizz, `GET /quizzes/:id/solution`) — les solutions ne sont donc
 * **jamais** pré-remplies ici, l'auteur les ressaisit à chaque édition structurelle. Signalé
 * explicitement à l'écran, pas silencieusement vidé.
 *
 * Routes API consommées :
 *   GET /exercises/:id  (content-catalog-service — pas de solution)
 *   PUT /exercises/:id  (content-catalog-service — remplace intégralement, supprime les images)
 *   POST /exercises/:id/parts/:partId/images           (ajout d'image de bloc, après coup)
 *   POST /exercises/:id/parts/:partId/solution/images  (ajout d'image de solution, après coup)
 */

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchExercise } from '../api/exercises'
import { buildEditableStateForExerciseEdit } from '../utils/exercisePayload'
import { ExerciseForm } from '../components/content-catalog/ExerciseForm'
import { ExerciseImageManager } from '../components/content-catalog/ExerciseImageManager'
import { getExerciseDisplayTitle } from '../utils/exerciseLabels'
import type { PublicExerciseDetail } from '../types/exercise'

export default function ExerciseEditPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const resolvedExerciseId = exerciseId ?? ''

  const {
    data: initialExercise,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchExercise(resolvedExerciseId), [resolvedExerciseId], {
    fallbackErrorMessage: 'Impossible de charger cet exercice pour modification.',
  })

  // La page conserve l'exercice courant après enregistrement structurel ou ajout d'image — une
  // donnée enregistrée reste affichée, jamais rechargée à chaque action (règle du 2026-08-10).
  const [exercise, setExercise] = useState<PublicExerciseDetail | null>(null)
  const currentExercise = exercise ?? initialExercise ?? null

  if (!resolvedExerciseId) {
    return (
      <Layout>
        <ErrorMessage message="Exercice introuvable." />
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement de l'exercice…</p>
      </Layout>
    )
  }

  if (loadError || !currentExercise) {
    return (
      <Layout>
        <ErrorMessage
          message={
            loadError ?? "Cet exercice est introuvable ou vous n'êtes pas autorisé à le modifier."
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
          onClick={() => navigate('/content/exercises')}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Retour au catalogue
        </button>

        <PageHeader
          title="Modifier l'exercice"
          subtitle={getExerciseDisplayTitle(currentExercise.title)}
        />

        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <p className="text-xs text-blue-800">
            La solution de chaque question n'est jamais relue automatiquement : ressaisissez-la si
            vous modifiez la structure de l'exercice ci-dessous.
          </p>
        </div>

        <ExerciseForm
          mode="edit"
          exerciseId={resolvedExerciseId}
          initialState={buildEditableStateForExerciseEdit(currentExercise)}
          onSaved={(saved) => setExercise(saved)}
          onCancel={() => navigate(`/content/exercises/${resolvedExerciseId}`)}
        />

        <ExerciseImageManager exercise={currentExercise} onExerciseChange={setExercise} />
      </div>
    </Layout>
  )
}
