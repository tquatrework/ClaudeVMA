/**
 * ProfileFieldList — liste de définition d'un ensemble de champs de profil, sans
 * carte ni titre.
 *
 * Extrait de `ProfileSection` pour être réutilisé par les écrans qui portent
 * déjà leur propre carte (statistiques pédagogiques). Sans cette extraction, la
 * distinction « non renseigné » / « non partagé » aurait fini réimplémentée une
 * seconde fois — et les deux implémentations auraient divergé.
 *
 * Trois états, et non deux :
 *
 * - **renseigné** — libellé + valeur ;
 * - **non renseigné** — la ligne n'est pas listée (une fiche n'énumère pas ce
 *   qui est vide) ;
 * - **non partagé** — la ligne EST listée, avec la pastille « Non partagé ».
 *
 * C'est la présence de la ligne qui distingue le troisième état du deuxième.
 * Les confondre laisserait croire au lecteur que la personne n'a rien saisi
 * alors qu'elle a choisi de ne pas partager (`docs/routes.md` § « Application en
 * lecture »).
 */

import React from 'react'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { formatProfileFieldValue, isEmptyFieldValue } from '../../utils/profileFieldDisplay'
import { NotSharedValue } from './NotSharedValue'

interface ProfileFieldListProps {
  data?: Record<string, unknown>
  /**
   * Champs de CETTE liste que le titulaire ne partage pas avec le lecteur —
   * déjà restreints à son périmètre par `pickHiddenFieldNames`, pour qu'un champ
   * pédagogique masqué n'apparaisse pas sous les informations administratives.
   */
  hiddenFieldNames?: readonly string[]
  className?: string
}

/** Y a-t-il quelque chose à montrer : une valeur, ou un champ à signaler ? */
export function hasProfileFieldRows(
  data?: Record<string, unknown>,
  hiddenFieldNames: readonly string[] = [],
): boolean {
  if (hiddenFieldNames.length > 0) return true
  return Object.values(data ?? {}).some((value) => !isEmptyFieldValue(value))
}

export function ProfileFieldList({
  data,
  hiddenFieldNames = [],
  className = 'space-y-3',
}: ProfileFieldListProps) {
  const filledEntries = Object.entries(data ?? {}).filter(([, value]) => !isEmptyFieldValue(value))

  return (
    <dl className={className}>
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

      {hiddenFieldNames.map((fieldName) => (
        <div key={fieldName} className="flex gap-4">
          <dt className="text-sm font-medium text-gray-500 w-56 shrink-0">
            {getProfileFieldLabel(fieldName)}
          </dt>
          <dd className="flex-1">
            <NotSharedValue />
          </dd>
        </div>
      ))}
    </dl>
  )
}
