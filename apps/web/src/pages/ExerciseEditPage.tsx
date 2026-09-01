/**
 * ExerciseEditPage — édition d'un Exercice par son auteur (structure et images, en une seule
 * soumission de formulaire depuis le 2026-09-01).
 *
 * Correctif du 2026-09-01 (`docs/architecture.md` > « Titre des Exercices et des Quizz », point 6) :
 * les solutions déjà saisies sont désormais pré-remplies quand `content-catalog-service` expose
 * `GET /exercises/:id/solutions` (réservée à l'auteur et aux AP/RP/TI, sur le modèle de
 * `GET /quizzes/:id/solution`). Tant que cette route n'est pas disponible ou échoue pour toute
 * autre raison, `fetchExerciseForEdit` retombe silencieusement sur `GET /exercises/:id` (pas de
 * solution) — l'auteur ressaisit alors sa solution comme avant, signalé par le bandeau ci-dessous,
 * affiché uniquement dans ce cas.
 *
 * `ExerciseImageManager` (upload d'image post-enregistrement, distinct du formulaire) est retiré
 * le même jour (arbitrage « Bloc "image" de premier niveau pour l'Exercice ») : les blocs image
 * font désormais partie de la séquence éditée par `ExerciseForm` lui-même, envoyés en un seul flux
 * de soumission (structure puis images en attente) — voir `utils/exerciseImageUpload.ts`.
 *
 * Routes API consommées :
 *   GET /exercises/:id/solutions  (content-catalog-service — avec solution, réservée à l'auteur)
 *   GET /exercises/:id            (content-catalog-service — repli, sans solution)
 *   PUT /exercises/:id            (content-catalog-service — remplace intégralement la structure)
 *   POST /exercises/:id/parts/:partId/images  (envoi de chaque image en attente, orchestré par `ExerciseForm`)
 */

import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchExerciseForEdit } from '../api/exercises'
import { buildEditableStateForExerciseEdit } from '../utils/exercisePayload'
import { ExerciseForm } from '../components/content-catalog/ExerciseForm'
import { getExerciseDisplayTitle } from '../utils/exerciseLabels'
import type { PublicExerciseDetail } from '../types/exercise'

export default function ExerciseEditPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const navigate = useNavigate()
  const resolvedExerciseId = exerciseId ?? ''

  const {
    data: loadResult,
    isLoading,
    error: loadError,
  } = useAsyncData(() => fetchExerciseForEdit(resolvedExerciseId), [resolvedExerciseId], {
    fallbackErrorMessage: 'Impossible de charger cet exercice pour modification.',
  })
  const initialExercise = loadResult?.exercise
  const solutionsPrefilled = loadResult?.solutionsPrefilled ?? false

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

        {!solutionsPrefilled && (
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            <p className="text-xs text-blue-800">
              Les solutions déjà saisies n'ont pas pu être rechargées : ressaisissez-les si vous
              modifiez la structure de l'exercice ci-dessous.
            </p>
          </div>
        )}

        <ExerciseForm
          mode="edit"
          exerciseId={resolvedExerciseId}
          initialState={buildEditableStateForExerciseEdit(currentExercise)}
          onSaved={(saved) => setExercise(saved)}
          onCancel={() => navigate(`/content/exercises/${resolvedExerciseId}`)}
        />
      </div>
    </Layout>
  )
}
