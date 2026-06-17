/**
 * ExerciseCatalogPage — Phase 12 (content-catalog-service)
 *
 * Catalogue des exercices pédagogiques.
 * L'élève et le formateur voient les exercices publiés.
 * Le formateur peut créer un exercice (avec solution obligatoire).
 * Le RP/AP voit en plus les exercices en attente de validation.
 *
 * Routes API consommées :
 *   GET  /exercises
 *   POST /exercises
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchExercises,
  createExercise,
  type Exercise,
  type DifficultyLevel,
} from '../api/contentCatalog'

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
}

const DIFFICULTY_BADGE_CLASSES: Record<DifficultyLevel, string> = {
  facile: 'bg-green-100 text-green-700',
  moyen: 'bg-yellow-100 text-yellow-700',
  difficile: 'bg-red-100 text-red-700',
}

export default function ExerciseCatalogPage() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const [exerciseList, setExerciseList] = useState<Exercise[]>([])
  const [isLoadingExercises, setIsLoadingExercises] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  // Champs du formulaire de création
  const [newExerciseTitle, setNewExerciseTitle] = useState('')
  const [newExerciseDescription, setNewExerciseDescription] = useState('')
  const [newExerciseSubject, setNewExerciseSubject] = useState('')
  const [newExerciseLevel, setNewExerciseLevel] = useState('')
  const [newExerciseDifficulty, setNewExerciseDifficulty] = useState<DifficultyLevel>('moyen')
  const [newExerciseSolution, setNewExerciseSolution] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isTeacher = hasRole('formateur')
  const isInternalUser = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
  )
  const canCreateExercise = isTeacher || isInternalUser

  useEffect(() => {
    setIsLoadingExercises(true)
    setLoadError(null)

    fetchExercises()
      .then((exercises) => setExerciseList(exercises))
      .catch(() => setLoadError('Impossible de charger les exercices.'))
      .finally(() => setIsLoadingExercises(false))
  }, [])

  const handleCreateExercise = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newExerciseSolution.trim()) {
      setCreateError('La solution est obligatoire pour créer un exercice.')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const createdExercise = await createExercise({
        title: newExerciseTitle.trim(),
        description: newExerciseDescription.trim(),
        subject: newExerciseSubject.trim(),
        level: newExerciseLevel.trim(),
        difficultyLevel: newExerciseDifficulty,
        solutionContent: newExerciseSolution.trim(),
      })

      setExerciseList((previous) => [createdExercise, ...previous])
      setShouldShowCreateForm(false)
      setNewExerciseTitle('')
      setNewExerciseDescription('')
      setNewExerciseSubject('')
      setNewExerciseLevel('')
      setNewExerciseDifficulty('moyen')
      setNewExerciseSolution('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError('Vous n\'êtes pas autorisé à créer un exercice.')
      } else {
        setCreateError('Impossible de créer l\'exercice. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenExercise = (exerciseId: string) => {
    navigate(`/content/exercises/${exerciseId}`)
  }

  if (isLoadingExercises) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des exercices…</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Exercices</h1>
            <p className="text-gray-500 text-sm mt-1">
              Catalogue des exercices pédagogiques disponibles.
            </p>
          </div>
          {canCreateExercise && (
            <button
              type="button"
              onClick={() => setShouldShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              Nouvel exercice
            </button>
          )}
        </div>

        {/* Formulaire de création */}
        {shouldShowCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer un exercice</h2>
            <p className="text-sm text-gray-500">
              La solution est obligatoire et ne sera pas publiée directement à l'élève.
            </p>

            <form onSubmit={handleCreateExercise} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="exercise-title" className="block text-sm text-gray-700 mb-1">
                    Titre <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exercise-title"
                    type="text"
                    required
                    value={newExerciseTitle}
                    onChange={(e) => setNewExerciseTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="exercise-subject" className="block text-sm text-gray-700 mb-1">
                    Matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exercise-subject"
                    type="text"
                    required
                    value={newExerciseSubject}
                    onChange={(e) => setNewExerciseSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="exercise-level" className="block text-sm text-gray-700 mb-1">
                    Niveau <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="exercise-level"
                    type="text"
                    required
                    value={newExerciseLevel}
                    onChange={(e) => setNewExerciseLevel(e.target.value)}
                    placeholder="ex: Terminale, 3ème…"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="exercise-difficulty" className="block text-sm text-gray-700 mb-1">
                    Difficulté
                  </label>
                  <select
                    id="exercise-difficulty"
                    value={newExerciseDifficulty}
                    onChange={(e) =>
                      setNewExerciseDifficulty(e.target.value as DifficultyLevel)
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  >
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="exercise-description" className="block text-sm text-gray-700 mb-1">
                  Énoncé <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="exercise-description"
                  required
                  rows={4}
                  value={newExerciseDescription}
                  onChange={(e) => setNewExerciseDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label htmlFor="exercise-solution" className="block text-sm text-gray-700 mb-1">
                  Solution <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs text-gray-400">(non visible par l'élève)</span>
                </label>
                <textarea
                  id="exercise-solution"
                  required
                  rows={4}
                  value={newExerciseSolution}
                  onChange={(e) => setNewExerciseSolution(e.target.value)}
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
                  {isCreating ? 'Création…' : 'Créer l\'exercice'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des exercices */}
        {exerciseList.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun exercice disponible pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {exerciseList.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => handleOpenExercise(exercise.id)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {exercise.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {exercise.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {exercise.subject}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {exercise.level}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          DIFFICULTY_BADGE_CLASSES[exercise.difficultyLevel]
                        }`}
                      >
                        {DIFFICULTY_LABELS[exercise.difficultyLevel]}
                      </span>
                      {exercise.status === 'pending_validation' && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                          En attente
                        </span>
                      )}
                    </div>
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
