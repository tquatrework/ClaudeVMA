/**
 * EvaluationMetadataFields — champs Niveau / Difficulté / Thème / Compétences / Durée / Blocage du
 * retour arrière de `EvaluationForm`, extraits pour garder ce dernier lisible (règle du projet,
 * seuil de 300 lignes) — même découpage que `ExerciseMetadataFields`.
 */

import React from 'react'

interface EvaluationMetadataFieldsProps {
  level: string
  onLevelChange: (value: string) => void
  difficulty: string
  onDifficultyChange: (value: string) => void
  theme: string
  onThemeChange: (value: string) => void
  competenciesInput: string
  onCompetenciesInputChange: (value: string) => void
  durationMinutes: string
  onDurationMinutesChange: (value: string) => void
  blockBackNavigation: boolean
  onBlockBackNavigationChange: (value: boolean) => void
  isSubmitting: boolean
}

export function EvaluationMetadataFields({
  level,
  onLevelChange,
  difficulty,
  onDifficultyChange,
  theme,
  onThemeChange,
  competenciesInput,
  onCompetenciesInputChange,
  durationMinutes,
  onDurationMinutesChange,
  blockBackNavigation,
  onBlockBackNavigationChange,
  isSubmitting,
}: EvaluationMetadataFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="evaluation-level" className="block text-xs text-gray-600 mb-1">
            Niveau
          </label>
          <input
            id="evaluation-level"
            type="text"
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
            placeholder="ex : Terminale, 3ème…"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="evaluation-difficulty" className="block text-xs text-gray-600 mb-1">
            Difficulté
          </label>
          <input
            id="evaluation-difficulty"
            type="text"
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            placeholder="ex : facile, moyen, difficile"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="evaluation-theme" className="block text-xs text-gray-600 mb-1">
            Thème
          </label>
          <input
            id="evaluation-theme"
            type="text"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
            placeholder="ex : géométrie plane"
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="evaluation-duration" className="block text-xs text-gray-600 mb-1">
            Durée (minutes) <span className="text-red-500">*</span>
          </label>
          <input
            id="evaluation-duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => onDurationMinutesChange(e.target.value)}
            required
            disabled={isSubmitting}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="evaluation-competencies" className="block text-xs text-gray-600 mb-1">
          Compétences travaillées (séparées par des virgules)
        </label>
        <input
          id="evaluation-competencies"
          type="text"
          value={competenciesInput}
          onChange={(e) => onCompetenciesInputChange(e.target.value)}
          disabled={isSubmitting}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={blockBackNavigation}
          onChange={(e) => onBlockBackNavigationChange(e.target.checked)}
          disabled={isSubmitting}
          className="rounded border-gray-300"
        />
        Bloquer le retour en arrière pendant le passage
      </label>
    </>
  )
}
