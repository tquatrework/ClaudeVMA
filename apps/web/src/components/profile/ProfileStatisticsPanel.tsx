/**
 * Panneau de statistiques pédagogiques d'une personne
 * (`GET /profiles/:userId/statistics`).
 *
 * Le droit de lecture vient de la **relation métier** et appartient au serveur :
 * titulaire, personnes reliées (élève ↔ formateur, parent ↔ élève, AP ↔ formateur),
 * administrateurs. Le panneau n'en juge pas — il demande, puis affiche ce qu'il
 * reçoit. Un refus revient en `404`, avec le même message qu'une absence de
 * statistiques : c'est voulu, on ne révèle pas l'existence de ce qu'on masque.
 *
 * Deux contrats de forme, vérifiés contre la pile réelle :
 * 1. la réponse est une **enveloppe** `{userId, profileType, statistics, visibility}` ;
 *    en phase 1, `statistics` porte les champs du profil pédagogique, libellés par
 *    le point unique `profileFieldLabels.ts` ;
 * 2. les réglages de visibilité s'y appliquent : un champ non partagé est **absent**
 *    de `statistics` et **nommé** dans `visibility.hiddenFields`, jamais confondu
 *    avec un champ vide.
 */

import React from 'react'
import { useProfileStatistics } from '../../hooks/profile/useProfileStatistics'
import { ProfileFieldList, hasProfileFieldRows } from './ProfileFieldList'
import {
  STATISTICS_DISPLAY_FIELD_NAMES,
  pickStatisticsDisplayFields,
} from '../../utils/profileFields'
import { pickHiddenFieldNames } from '../../utils/profileVisibility'

interface ProfileStatisticsPanelProps {
  userId: string
}

export default function ProfileStatisticsPanel({ userId }: ProfileStatisticsPanelProps) {
  const { statistics, visibility, isLoading, hasError } = useProfileStatistics(userId)

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
