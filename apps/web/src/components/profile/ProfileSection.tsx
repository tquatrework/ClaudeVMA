/**
 * ProfileSection — rendu générique clé/valeur d'un bloc de profil.
 *
 * Les libellés viennent du point unique `src/utils/profileFieldLabels.ts` et les
 * valeurs de `src/utils/profileFieldDisplay.ts` : cette vue ne fabrique ni
 * traduction ni format de date. Un champ inconnu de la table de libellés est
 * affiché avec un repli lisible, jamais avec son nom technique brut.
 */

import React from 'react'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { formatProfileFieldValue, isEmptyFieldValue } from '../../utils/profileFieldDisplay'

interface ProfileSectionProps {
  title?: string
  description?: string
  data?: Record<string, unknown>
  emptyMessage: string
}

export function ProfileSection({ title, description, data, emptyMessage }: ProfileSectionProps) {
  const filledEntries = Object.entries(data ?? {}).filter(([, value]) => !isEmptyFieldValue(value))

  if (filledEntries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {title && <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>}
        {description && <p className="text-sm text-gray-500 mb-2">{description}</p>}
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      {title && <h2 className="text-lg font-semibold text-gray-800 mb-1">{title}</h2>}
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      <dl className={`space-y-3 ${title && !description ? 'mt-4' : ''}`}>
        {filledEntries.map(([fieldName, value]) => (
          <div key={fieldName} className="flex gap-4">
            <dt className="text-sm font-medium text-gray-500 w-56 shrink-0">
              {getProfileFieldLabel(fieldName)}
            </dt>
            <dd className="text-sm text-gray-800 flex-1 whitespace-pre-line">
              {formatProfileFieldValue(fieldName, value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
