/**
 * ProfileSection — carte d'un bloc de profil : titre, description et liste de
 * champs.
 *
 * Les libellés viennent du point unique `src/utils/profileFieldLabels.ts` et les
 * valeurs de `src/utils/profileFieldDisplay.ts` : cette vue ne fabrique ni
 * traduction ni format de date. Le rendu des lignes — dont la distinction entre
 * champ non renseigné et champ non partagé — appartient à `ProfileFieldList`.
 */

import React from 'react'
import { ProfileFieldList, hasProfileFieldRows } from './ProfileFieldList'

interface ProfileSectionProps {
  title?: string
  description?: string
  data?: Record<string, unknown>
  /**
   * Champs de la section, dans l'ordre du contrat. Fournis, ils sont **tous**
   * listés — un champ vide porte « Non renseigné » plutôt que de disparaître.
   */
  fieldNames?: readonly string[]
  emptyMessage: string
  /**
   * Champs de CETTE section que le titulaire ne partage pas avec le lecteur —
   * déjà restreints au périmètre de la section par `pickHiddenFieldNames`.
   */
  hiddenFieldNames?: readonly string[]
}

export function ProfileSection({
  title,
  description,
  data,
  fieldNames,
  emptyMessage,
  hiddenFieldNames = [],
}: ProfileSectionProps) {
  const hasRows = hasProfileFieldRows(data, hiddenFieldNames, fieldNames)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      {title && (
        <h2 className={`text-lg font-semibold text-gray-800 ${hasRows ? 'mb-1' : 'mb-2'}`}>
          {title}
        </h2>
      )}
      {description && (
        <p className={`text-sm text-gray-500 ${hasRows ? 'mb-4' : 'mb-2'}`}>{description}</p>
      )}

      {hasRows ? (
        <ProfileFieldList
          data={data}
          fieldNames={fieldNames}
          hiddenFieldNames={hiddenFieldNames}
          className={`space-y-3 ${title && !description ? 'mt-4' : ''}`}
        />
      ) : (
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      )}
    </div>
  )
}
