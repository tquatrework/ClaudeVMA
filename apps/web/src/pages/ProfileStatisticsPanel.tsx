/**
 * Panneau de statistiques pédagogiques d'un utilisateur
 * (`GET /profiles/:userId/statistics`).
 *
 * Visible pour l'utilisateur lui-même, les formateurs liés, les parents et les
 * rôles internes.
 *
 * Deux corrections portées ici :
 *
 * 1. la réponse est une **enveloppe** `{userId, profileType, statistics, visibility}` ;
 *    les indicateurs lus jusqu'ici à la racine (`totalSessionsAttended`…)
 *    n'existent pas — en phase 1 `statistics` porte les données du profil
 *    pédagogique, libellées par le point unique `profileFieldLabels.ts` ;
 * 2. la route applique **les mêmes réglages de visibilité** que le bloc
 *    `pedagogical` : un champ non partagé est absent de `statistics` et doit être
 *    signalé comme tel, jamais confondu avec un champ vide.
 */

import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useProfileStatistics } from '../hooks/profile/useProfileStatistics'
import {
  ProfileFieldList,
  hasProfileFieldRows,
} from '../components/profile/ProfileFieldList'
import {
  STATISTICS_DISPLAY_FIELD_NAMES,
  pickStatisticsDisplayFields,
} from '../utils/profileFields'
import { pickHiddenFieldNames } from '../utils/profileVisibility'

interface Props {
  userId: string
}

export default function ProfileStatisticsPanel({ userId }: Props) {
  const { user, hasRole } = useAuth()

  const isViewingOwnProfile = user?.id === userId
  const canViewStatistics =
    isViewingOwnProfile ||
    hasRole(
      'formateur',
      'parent_financeur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    )

  const { statistics, visibility, isLoading, hasError } = useProfileStatistics(
    userId,
    canViewStatistics,
  )

  if (!canViewStatistics) return null

  const displayedFields = pickStatisticsDisplayFields(statistics)
  const hiddenFieldNames = pickHiddenFieldNames(STATISTICS_DISPLAY_FIELD_NAMES, visibility)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Statistiques pédagogiques</h2>

      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

      {hasError && (
        <p className="text-gray-400 text-sm">Statistiques non disponibles pour le moment</p>
      )}

      {!isLoading &&
        !hasError &&
        (hasProfileFieldRows(displayedFields, hiddenFieldNames) ? (
          <ProfileFieldList data={displayedFields} hiddenFieldNames={hiddenFieldNames} />
        ) : (
          <p className="text-gray-400 text-sm">Aucune statistique disponible</p>
        ))}
    </div>
  )
}
