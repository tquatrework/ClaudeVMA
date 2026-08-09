/**
 * FieldVisibilityGroup — un bloc de l'écran de confidentialité : la liste des
 * champs d'un même `block`, chacun avec son choix de public.
 *
 * Les libellés (champs, blocs, publics) viennent du point unique
 * `src/utils/profileFieldLabels.ts`. Le catalogue et les valeurs par défaut
 * viennent du serveur : ce composant n'en connaît aucun.
 */

import React from 'react'
import type { FieldVisibilityAudience, FieldVisibilityEntry } from '../../types/profile'
import {
  getFieldVisibilityAudienceLabel,
  getFieldVisibilityBlockLabel,
  getProfileFieldLabel,
} from '../../utils/profileFieldLabels'

/** Ordre d'affichage des trois publics, du plus restreint au plus large. */
export const AUDIENCE_CHOICES: readonly FieldVisibilityAudience[] = ['self', 'linked', 'all']

interface FieldVisibilityGroupProps {
  block: string
  entries: FieldVisibilityEntry[]
  /** Public actuellement sélectionné pour chaque champ (réglages en cours d'édition). */
  selectedAudiences: Record<string, FieldVisibilityAudience>
  onAudienceChange: (fieldName: string, audience: FieldVisibilityAudience) => void
  isDisabled: boolean
}

function AudienceChoice({
  fieldName,
  audience,
  isSelected,
  isDisabled,
  onSelect,
}: {
  fieldName: string
  audience: FieldVisibilityAudience
  isSelected: boolean
  isDisabled: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm cursor-pointer rounded-lg border px-3 py-1.5 ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
          : 'border-gray-200 text-gray-600 hover:border-gray-300'
      } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <input
        type="radio"
        name={`visibility-${fieldName}`}
        value={audience}
        checked={isSelected}
        disabled={isDisabled}
        onChange={onSelect}
        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-400"
      />
      {getFieldVisibilityAudienceLabel(audience)}
    </label>
  )
}

export function FieldVisibilityGroup({
  block,
  entries,
  selectedAudiences,
  onAudienceChange,
  isDisabled,
}: FieldVisibilityGroupProps) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4">
        {getFieldVisibilityBlockLabel(block)}
      </h2>

      <ul className="space-y-4">
        {entries.map((entry) => {
          const selectedAudience = selectedAudiences[entry.fieldName] ?? entry.audience
          return (
            <li
              key={entry.fieldName}
              className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-gray-100 last:border-b-0 pb-4 last:pb-0"
            >
              <div className="md:w-64">
                <p className="text-sm font-medium text-gray-800">
                  {getProfileFieldLabel(entry.fieldName)}
                </p>
                {entry.isPrescription && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Rédigé par le responsable pédagogique
                  </p>
                )}
                {entry.isReserved && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Champ prévu, pas encore utilisé sur la plateforme
                  </p>
                )}
                {!entry.isExplicit && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Réglage par défaut : {getFieldVisibilityAudienceLabel(entry.defaultAudience)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {AUDIENCE_CHOICES.map((audience) => (
                  <AudienceChoice
                    key={audience}
                    fieldName={entry.fieldName}
                    audience={audience}
                    isSelected={selectedAudience === audience}
                    isDisabled={isDisabled}
                    onSelect={() => onAudienceChange(entry.fieldName, audience)}
                  />
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
