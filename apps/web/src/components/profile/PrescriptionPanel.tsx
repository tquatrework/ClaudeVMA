/**
 * PrescriptionPanel — lecture de la section prescription du profil pédagogique.
 *
 * Ce bloc n'est pas un formulaire désactivé : c'est le propos d'une autre
 * personne, le responsable pédagogique, sur le titulaire du profil. Il est donc
 * présenté comme une note attribuée — auteur et date en tête —, visuellement
 * distinct de ce que le titulaire a lui-même déclaré.
 *
 * `filledBy` est un identifiant technique : il n'est jamais affiché tel quel,
 * `usePersonDisplayName` le résout en « Prénom Nom » (repli sur le libellé du
 * rôle si la lecture du profil du RP n'est pas autorisée).
 */

import React from 'react'
import type { PedagogicalProfileType, ProfileVisibility } from '../../types/profile'
import { prescriptionFieldNames } from '../../utils/profileFields'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { formatProfileFieldValue, isEmptyFieldValue } from '../../utils/profileFieldDisplay'
import { formatLocalDate } from '../../utils/dateFormat'
import {
  PRESCRIPTION_NOT_SHARED_MESSAGE,
  pickHiddenFieldNames,
} from '../../utils/profileVisibility'
import { usePersonDisplayName } from '../../hooks/profile/usePersonDisplayName'
import { NotSharedValue } from './NotSharedValue'

const PEDAGOGICAL_MANAGER_LABEL = 'Responsable pédagogique'

interface PrescriptionPanelProps {
  pedagogicalType: PedagogicalProfileType
  /** Bloc `pedagogical` à plat, tel que renvoyé par `GET /profiles/:userId`. */
  pedagogical: Record<string, unknown> | null
  /** Message affiché quand aucune prescription n'a encore été rédigée. */
  emptyMessage?: string
  /** Bloc `visibility` de la lecture — absent quand la fiche est entière. */
  visibility?: ProfileVisibility
}

function readOptionalString(
  source: Record<string, unknown> | null,
  fieldName: string,
): string | null {
  const value = source?.[fieldName]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function PrescriptionPanel({
  pedagogicalType,
  pedagogical,
  emptyMessage = "Aucune prescription n'a encore été rédigée par le responsable pédagogique.",
  visibility,
}: PrescriptionPanelProps) {
  const filledBy = readOptionalString(pedagogical, 'filledBy')
  const filledAt = readOptionalString(pedagogical, 'filledAt')
  const { displayName: authorName } = usePersonDisplayName(filledBy, PEDAGOGICAL_MANAGER_LABEL)

  const displayedFieldNames = prescriptionFieldNames(pedagogicalType)

  const entries = displayedFieldNames
    .map((fieldName) => [fieldName, pedagogical?.[fieldName]] as const)
    .filter(([, value]) => !isEmptyFieldValue(value))

  /**
   * Sans cette distinction, une prescription entièrement masquée s'afficherait
   * « Aucune prescription n'a encore été rédigée » — un mensonge, puisque le
   * serveur ne masque que ce qui est réglé, pas ce qui est vide.
   */
  const hiddenFieldNames = pickHiddenFieldNames(displayedFieldNames, visibility)
  const hasNothingToShow = entries.length === 0 && hiddenFieldNames.length === 0

  return (
    <section className="bg-white border border-gray-200 border-l-4 border-l-indigo-400 rounded-xl p-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-800">
            Préconisations du responsable pédagogique
          </h2>
          <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
            Rédigé par le responsable pédagogique
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Ces éléments sont rédigés sur vous par le responsable pédagogique. Vous les consultez ;
          leur modification lui appartient.
        </p>
        {(authorName || filledAt) && (
          <p className="text-sm text-gray-600 mt-3">
            {authorName && <span className="font-medium text-gray-800">{authorName}</span>}
            {authorName && filledAt && ' — '}
            {filledAt && <span>mis à jour le {formatLocalDate(filledAt)}</span>}
          </p>
        )}
      </header>

      {hasNothingToShow ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <>
          {entries.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">{PRESCRIPTION_NOT_SHARED_MESSAGE}</p>
          )}
          <dl className="space-y-4">
            {entries.map(([fieldName, value]) => (
              <div key={fieldName}>
                <dt className="text-sm font-medium text-gray-500">
                  {getProfileFieldLabel(fieldName)}
                </dt>
                <dd className="text-sm text-gray-800 mt-1 whitespace-pre-line border-l-2 border-gray-100 pl-3">
                  {formatProfileFieldValue(fieldName, value)}
                </dd>
              </div>
            ))}

            {hiddenFieldNames.map((fieldName) => (
              <div key={fieldName}>
                <dt className="text-sm font-medium text-gray-500">
                  {getProfileFieldLabel(fieldName)}
                </dt>
                <dd className="mt-1 pl-3">
                  <NotSharedValue />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
