/**
 * EvaluationCreateForm — formulaire de création d'une évaluation (solution obligatoire).
 * Extrait de EvaluationCatalogPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import type { DifficultyLevel } from '../../api/contentCatalog'

interface EvaluationCreateFormProps {
  newTitle: string
  newDescription: string
  newSubject: string
  newLevel: string
  newDifficulty: DifficultyLevel
  newSolution: string
  newDurationMinutes: number | ''
  isCreating: boolean
  createError: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onLevelChange: (value: string) => void
  onDifficultyChange: (value: DifficultyLevel) => void
  onSolutionChange: (value: string) => void
  onDurationMinutesChange: (value: number | '') => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function EvaluationCreateForm({
  newTitle,
  newDescription,
  newSubject,
  newLevel,
  newDifficulty,
  newSolution,
  newDurationMinutes,
  isCreating,
  createError,
  onTitleChange,
  onDescriptionChange,
  onSubjectChange,
  onLevelChange,
  onDifficultyChange,
  onSolutionChange,
  onDurationMinutesChange,
  onSubmit,
  onCancel,
}: EvaluationCreateFormProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Créer une évaluation</h2>
      <p className="text-sm text-gray-500">
        La solution est obligatoire et ne sera pas publiée directement à l'élève.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
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
              onChange={(e) => onTitleChange(e.target.value)}
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
              onChange={(e) => onSubjectChange(e.target.value)}
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
              onChange={(e) => onLevelChange(e.target.value)}
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
              onChange={(e) => onDifficultyChange(e.target.value as DifficultyLevel)}
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
                onDurationMinutesChange(e.target.value ? Number(e.target.value) : '')
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
            onChange={(e) => onDescriptionChange(e.target.value)}
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
            onChange={(e) => onSolutionChange(e.target.value)}
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
            onClick={onCancel}
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
  )
}
