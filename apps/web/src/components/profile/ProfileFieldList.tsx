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
 * - **non renseigné** — libellé + mention « Non renseigné » ;
 * - **non partagé** — libellé + pastille « Non partagé ».
 *
 * Les trois sont **listés**. Un champ vide n'est plus escamoté : sur les profils
 * réels, presque tout est vide, et une fiche qui n'affiche que le prénom et le
 * nom laisse croire que le reste n'existe pas (constat du 2026-08-09 sur la pile
 * réelle). Le lecteur doit voir la liste complète des champs du contrat, qu'ils
 * soient remplis ou non.
 *
 * « Non renseigné » et « Non partagé » ne se confondent pas : le premier dit que
 * personne n'a rien saisi, le second que le titulaire a choisi de ne pas montrer
 * ce qu'il a saisi (`docs/routes.md` § « Application en lecture »).
 */

import React from 'react'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import {
  formatProfileFieldValue,
  isEmptyFieldValue,
  EMPTY_VALUE_PLACEHOLDER,
} from '../../utils/profileFieldDisplay'
import { NotSharedValue } from './NotSharedValue'

interface ProfileFieldListProps {
  data?: Record<string, unknown>
  /**
   * Champs à lister, **dans l'ordre du contrat**, qu'ils portent une valeur ou
   * non. Omis, la liste se limite aux clés reçues — repli réservé aux écrans dont
   * le jeu de champs n'est pas connu d'avance (statistiques, où l'union des
   * champs élève et formateur ferait afficher les champs de l'autre rôle).
   */
  fieldNames?: readonly string[]
  /**
   * Champs de CETTE liste que le titulaire ne partage pas avec le lecteur —
   * déjà restreints à son périmètre par `pickHiddenFieldNames`, pour qu'un champ
   * pédagogique masqué n'apparaisse pas sous les informations administratives.
   */
  hiddenFieldNames?: readonly string[]
  className?: string
}

/** Ordre d'affichage retenu : celui du contrat, sinon celui des clés reçues. */
function resolveListedFieldNames(
  data: Record<string, unknown> | undefined,
  fieldNames: readonly string[] | undefined,
  hiddenFieldNames: readonly string[],
): readonly string[] {
  if (fieldNames) return fieldNames

  const namesFromData = Object.keys(data ?? {})
  const missingHiddenNames = hiddenFieldNames.filter((name) => !namesFromData.includes(name))
  return [...namesFromData, ...missingHiddenNames]
}

/** Y a-t-il quelque chose à montrer : une valeur, ou un champ à signaler ? */
export function hasProfileFieldRows(
  data?: Record<string, unknown>,
  hiddenFieldNames: readonly string[] = [],
  fieldNames?: readonly string[],
): boolean {
  // Une liste de champs attendue est toujours affichée en entier, même vide :
  // c'est elle qui dit au titulaire ce qu'il peut renseigner.
  if (fieldNames && fieldNames.length > 0) return true
  if (hiddenFieldNames.length > 0) return true
  return Object.values(data ?? {}).some((value) => !isEmptyFieldValue(value))
}

/** Valeur affichée pour un champ que personne n'a encore renseigné. */
function EmptyValue() {
  return <span className="text-sm text-gray-400 italic">{EMPTY_VALUE_PLACEHOLDER}</span>
}

export function ProfileFieldList({
  data,
  fieldNames,
  hiddenFieldNames = [],
  className = 'space-y-3',
}: ProfileFieldListProps) {
  const listedFieldNames = resolveListedFieldNames(data, fieldNames, hiddenFieldNames)

  return (
    <dl className={className}>
      {listedFieldNames.map((fieldName) => {
        const isHidden = hiddenFieldNames.includes(fieldName)
        const value = data?.[fieldName]

        return (
          <div key={fieldName} className="flex gap-4">
            <dt className="text-sm font-medium text-gray-500 w-56 shrink-0">
              {getProfileFieldLabel(fieldName)}
            </dt>
            <dd className="text-sm text-gray-800 flex-1 whitespace-pre-line">
              {isHidden ? (
                <NotSharedValue />
              ) : isEmptyFieldValue(value) ? (
                <EmptyValue />
              ) : (
                formatProfileFieldValue(fieldName, value)
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
