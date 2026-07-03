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
import { CatalogItemCard } from '../components/ui/CatalogItemCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_BADGE_CLASSES,
} from '../types/content'
import {
  fetchExercises,
  createExercise,
  type Exercise,
  type DifficultyLevel,
} from '../api/contentCatalog'

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
        <PageHeader
          title="Exercices"
          subtitle="Catalogue des exercices pédagogiques disponibles."
          action={
            canCreateExercise ? (
              <button
                type="button"
                onClick={() => setShouldShowCreateForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Nouvel exercice
              </button>
            ) : undefined
          }
        />

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
            <EmptyState message="Aucun exercice disponible pour le moment." />
          </div>
        ) : (
          <ul className="space-y-3">
            {exerciseList.map((exercise) => (
              <CatalogItemCard
                key={exercise.id}
                id={exercise.id}
                title={exercise.title}
                description={exercise.description}
                tags={[
                  { label: exercise.subject, colorClass: 'bg-blue-50 text-blue-700' },
                  { label: exercise.level },
                ]}
                rightBadge={
                  <>
                    <StatusBadge
                      status={exercise.difficultyLevel}
                      label={DIFFICULTY_LABELS[exercise.difficultyLevel]}
                      badgeClasses={DIFFICULTY_BADGE_CLASSES}
                    />
                    {exercise.status === 'pending_validation' && (
                      <StatusBadge
                        status="pending_validation"
                        label="En attente"
                        badgeClasses={{ pending_validation: 'bg-orange-100 text-orange-700' }}
                      />
                    )}
                  </>
                }
                onSelect={handleOpenExercise}
              />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
