/**
 * FilteredProfileNotice — bandeau affiché **une seule fois** en tête d'une fiche
 * dont le serveur a retiré des champs.
 *
 * Il répond à la question que le lecteur se pose en voyant « Non partagé » :
 * pourquoi, et est-ce que quelque chose a raté ? Sans lui, la mention par champ
 * serait une frustration sèche ; répétée sous chaque champ, elle deviendrait un
 * reproche adressé au titulaire.
 *
 * Ne s'affiche jamais pour le titulaire, le parent financeur rattaché ni les
 * administrateurs : le serveur leur renvoie `isFiltered: false`.
 */

import React from 'react'
import type { ProfileVisibility } from '../../types/profile'
import {
  FILTERED_PROFILE_DESCRIPTION,
  FILTERED_PROFILE_TITLE,
  isProfileFiltered,
} from '../../utils/profileVisibility'

interface FilteredProfileNoticeProps {
  visibility?: ProfileVisibility
}

export function FilteredProfileNotice({ visibility }: FilteredProfileNoticeProps) {
  if (!isProfileFiltered(visibility)) return null

  return (
    <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-sm font-medium text-slate-700">{FILTERED_PROFILE_TITLE}</p>
      <p className="text-sm text-slate-500 mt-1">{FILTERED_PROFILE_DESCRIPTION}</p>
    </div>
  )
}
