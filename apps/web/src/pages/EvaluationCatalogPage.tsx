/**
 * EvaluationCatalogPage — Phase 12 (content-catalog-service)
 *
 * Catalogue des évaluations pédagogiques.
 * L'élève et le formateur voient les évaluations publiées.
 * Le formateur peut créer une évaluation (avec solution obligatoire non publiée).
 * Le RP/AP voit les évaluations en attente de validation.
 *
 * Routes API consommées :
 *   GET  /evaluations
 *   POST /evaluations
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
  fetchEvaluations,
  createEvaluation,
  type Evaluation,
  type DifficultyLevel,
} from '../api/contentCatalog'

export default function EvaluationCatalogPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [evaluationList, setEvaluationList] = useState<Evaluation[]>([])
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [shouldShowCreateForm, setShouldShowCreateForm] = useState(false)

  // Champs du formulaire de création
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newLevel, setNewLevel] = useState('')
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel>('moyen')
  const [newSolution, setNewSolution] = useState('')
  const [newDurationMinutes, setNewDurationMinutes] = useState<number | ''>('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const isTeacher = hasRole('formateur')
  const isInternalUser = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
  )
  const canCreateEvaluation = isTeacher || isInternalUser

  useEffect(() => {
    setIsLoadingEvaluations(true)
    setLoadError(null)

    fetchEvaluations()
      .then((evaluations) => setEvaluationList(evaluations))
      .catch(() => setLoadError('Impossible de charger les évaluations.'))
      .finally(() => setIsLoadingEvaluations(false))
  }, [])

  const handleCreateEvaluation = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!newSolution.trim()) {
      setCreateError('La solution est obligatoire pour créer une évaluation.')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const createdEvaluation = await createEvaluation({
        title: newTitle.trim(),
        description: newDescription.trim(),
        subject: newSubject.trim(),
        level: newLevel.trim(),
        difficultyLevel: newDifficulty,
        solutionContent: newSolution.trim(),
        durationMinutes: newDurationMinutes !== '' ? Number(newDurationMinutes) : undefined,
      })

      setEvaluationList((previous) => [createdEvaluation, ...previous])
      setShouldShowCreateForm(false)
      setNewTitle('')
      setNewDescription('')
      setNewSubject('')
      setNewLevel('')
      setNewDifficulty('moyen')
      setNewSolution('')
      setNewDurationMinutes('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setCreateError('Vous n\'êtes pas autorisé à créer une évaluation.')
      } else {
        setCreateError('Impossible de créer l\'évaluation. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenEvaluation = (evaluationId: string) => {
    navigate(`/content/evaluations/${evaluationId}`)
  }

  if (isLoadingEvaluations) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des évaluations…</p>
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
          title="Évaluations"
          subtitle="Catalogue des évaluations pédagogiques disponibles."
          action={
            canCreateEvaluation ? (
              <button
                type="button"
                onClick={() => setShouldShowCreateForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Nouvelle évaluation
              </button>
            ) : undefined
          }
        />

        {/* Formulaire de création */}
        {shouldShowCreateForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Créer une évaluation</h2>
            <p className="text-sm text-gray-500">
              La solution est obligatoire et ne sera pas publiée directement à l'élève.
            </p>

            <form onSubmit={handleCreateEvaluation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="eval-title" className="block text-sm text-gray-700 mb-1">
                    Titre <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="eval-title"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="eval-subject" className="block text-sm text-gray-700 mb-1">
                    Matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="eval-subject"
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label htmlFor="eval-level" className="block text-sm text-gray-700 mb-1">
                    Niveau <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="eval-level"
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
                  <label htmlFor="eval-difficulty" className="block text-sm text-gray-700 mb-1">
                    Difficulté
                  </label>
                  <select
                    id="eval-difficulty"
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  >
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="eval-duration" className="block text-sm text-gray-700 mb-1">
                    Durée (minutes)
                  </label>
                  <input
                    id="eval-duration"
                    type="number"
                    min={1}
                    value={newDurationMinutes}
                    onChange={(e) =>
                      setNewDurationMinutes(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="ex: 60"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="eval-description" className="block text-sm text-gray-700 mb-1">
                  Énoncé <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="eval-description"
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label htmlFor="eval-solution" className="block text-sm text-gray-700 mb-1">
                  Solution <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs text-gray-400">(non visible par l'élève)</span>
                </label>
                <textarea
                  id="eval-solution"
                  required
                  rows={4}
                  value={newSolution}
                  onChange={(e) => setNewSolution(e.target.value)}
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
                  {isCreating ? 'Création…' : 'Créer l\'évaluation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des évaluations */}
        {evaluationList.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <EmptyState message="Aucune évaluation disponible pour le moment." />
          </div>
        ) : (
          <ul className="space-y-3">
            {evaluationList.map((evaluation) => (
              <CatalogItemCard
                key={evaluation.id}
                id={evaluation.id}
                title={evaluation.title}
                description={evaluation.description}
                tags={[
                  { label: evaluation.subject, colorClass: 'bg-blue-50 text-blue-700' },
                  { label: evaluation.level },
                  ...(evaluation.durationMinutes
                    ? [{ label: `${evaluation.durationMinutes} min` }]
                    : []),
                ]}
                rightBadge={
                  <>
                    <StatusBadge
                      status={evaluation.difficultyLevel}
                      label={DIFFICULTY_LABELS[evaluation.difficultyLevel]}
                      badgeClasses={DIFFICULTY_BADGE_CLASSES}
                    />
                    {evaluation.status === 'pending_validation' && (
                      <StatusBadge
                        status="pending_validation"
                        label="En attente"
                        badgeClasses={{ pending_validation: 'bg-orange-100 text-orange-700' }}
                      />
                    )}
                  </>
                }
                onSelect={handleOpenEvaluation}
              />
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
