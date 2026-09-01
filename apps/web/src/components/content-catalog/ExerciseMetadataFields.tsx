/**
 * ExerciseMetadataFields — champs Niveau / Difficulté / Thème / Compétences de `ExerciseForm`,
 * extraits pour garder ce dernier lisible (règle du projet, seuil de 300 lignes).
 */

import React from 'react'

interface ExerciseMetadataFieldsProps {
  level: string
  onLevelChange: (value: string) => void
  difficulty: string
  onDifficultyChange: (value: string) => void
  theme: string
  onThemeChange: (value: string) => void
  competenciesInput: string
  onCompetenciesInputChange: (value: string) => void
  isSubmitting: boolean
}

export function ExerciseMetadataFields({
  level,
  onLevelChange,
  difficulty,
  onDifficultyChange,
  theme,
  onThemeChange,
  competenciesInput,
  onCompetenciesInputChange,
  isSubmitting,
}: ExerciseMetadataFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="exercise-level" className="block text-xs text-gray-600 mb-1">
            Niveau
          </label>
          <input
            id="exercise-level"
            type="text"
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
            placeholder="ex : Terminale, 3ème…"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="exercise-difficulty" className="block text-xs text-gray-600 mb-1">
            Difficulté
          </label>
          <input
            id="exercise-difficulty"
            type="text"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            placeholder="ex : facile, moyen, difficile"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="exercise-theme" className="block text-xs text-gray-600 mb-1">
            Thème
          </label>
          <input
            id="exercise-theme"
            type="text"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
            placeholder="ex : géométrie plane"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="exercise-competencies" className="block text-xs text-gray-600 mb-1">
          Compétences travaillées (séparées par des virgules)
        </label>
        <input
          id="exercise-competencies"
          type="text"
          value={competenciesInput}
          onChange={(e) => onCompetenciesInputChange(e.target.value)}
          disabled={isSubmitting}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
    </>
  )
}
