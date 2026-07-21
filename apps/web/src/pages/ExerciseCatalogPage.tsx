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
import { ExerciseCreateForm } from '../components/content-catalog/ExerciseCreateForm'

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
          <ExerciseCreateForm
            newExerciseTitle={newExerciseTitle}
            newExerciseDescription={newExerciseDescription}
            newExerciseSubject={newExerciseSubject}
            newExerciseLevel={newExerciseLevel}
            newExerciseDifficulty={newExerciseDifficulty}
            newExerciseSolution={newExerciseSolution}
            isCreating={isCreating}
            createError={createError}
            onTitleChange={setNewExerciseTitle}
            onDescriptionChange={setNewExerciseDescription}
            onSubjectChange={setNewExerciseSubject}
            onLevelChange={setNewExerciseLevel}
            onDifficultyChange={setNewExerciseDifficulty}
            onSolutionChange={setNewExerciseSolution}
            onSubmit={handleCreateExercise}
            onCancel={() => setShouldShowCreateForm(false)}
          />
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
