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
import type { PedagogicalProfileType } from '../../types/profile'
import { prescriptionFieldNames } from '../../utils/profileFields'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import { formatProfileFieldValue, isEmptyFieldValue } from '../../utils/profileFieldDisplay'
import { formatLocalDate } from '../../utils/dateFormat'
import { usePersonDisplayName } from '../../hooks/profile/usePersonDisplayName'

const PEDAGOGICAL_MANAGER_LABEL = 'Responsable pédagogique'

interface PrescriptionPanelProps {
  pedagogicalType: PedagogicalProfileType
  /** Bloc `pedagogical` à plat, tel que renvoyé par `GET /profiles/:userId`. */
  pedagogical: Record<string, unknown> | null
  /** Message affiché quand aucune prescription n'a encore été rédigée. */
  emptyMessage?: string
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
}: PrescriptionPanelProps) {
  const filledBy = readOptionalString(pedagogical, 'filledBy')
  const filledAt = readOptionalString(pedagogical, 'filledAt')
  const { displayName: authorName } = usePersonDisplayName(filledBy, PEDAGOGICAL_MANAGER_LABEL)

  const entries = prescriptionFieldNames(pedagogicalType)
    .map((fieldName) => [fieldName, pedagogical?.[fieldName]] as const)
    .filter(([, value]) => !isEmptyFieldValue(value))

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

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
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
        </dl>
      )}
    </section>
  )
}
