/**
 * PedagogicalProfilePanel — lecture du profil pédagogique, en deux sections
 * clairement séparées bien que le serveur les renvoie à plat :
 *
 * 1. ce que le titulaire a déclaré sur lui-même ;
 * 2. ce que le responsable pédagogique a prescrit *sur* lui, attribué et daté.
 *
 * La séparation est ici une question de sens, pas de mise en page : le titulaire
 * doit voir d'un coup d'œil ce qui vient de lui et ce qui vient d'un tiers.
 */

import React from 'react'
import type { PedagogicalProfileKind, ProfileVisibility } from '../../types/profile'
import { declarativeDisplayFieldNames, pickDeclarativeDisplayFields } from '../../utils/profileFields'
import { pickHiddenFieldNames } from '../../utils/profileVisibility'
import { ProfileSection } from './ProfileSection'
import { PrescriptionPanel } from './PrescriptionPanel'

interface PedagogicalProfilePanelProps {
  pedagogicalKind: PedagogicalProfileKind
  pedagogical: Record<string, unknown> | null
  /** Bloc `visibility` de la lecture — absent quand la fiche est entière. */
  visibility?: ProfileVisibility
}

export function PedagogicalProfilePanel({
  pedagogicalKind,
  pedagogical,
  visibility,
}: PedagogicalProfilePanelProps) {
  if (pedagogicalKind === 'unknown') {
    return (
      <ProfileSection
        title="Profil pédagogique"
        data={undefined}
        emptyMessage="Profil pédagogique non renseigné"
      />
    )
  }

  return (
    <div className="space-y-6">
      <ProfileSection
        title="Informations déclarées"
        description={
          pedagogicalKind === 'teacher'
            ? 'Ce que le formateur déclare sur son enseignement.'
            : "Ce que l'élève déclare sur sa scolarité."
        }
        data={pickDeclarativeDisplayFields(pedagogicalKind, pedagogical)}
        emptyMessage="Profil pédagogique non renseigné"
        hiddenFieldNames={pickHiddenFieldNames(
          declarativeDisplayFieldNames(pedagogicalKind),
          visibility,
        )}
      />

      <PrescriptionPanel
        pedagogicalType={pedagogicalKind}
        pedagogical={pedagogical}
        visibility={visibility}
      />
    </div>
  )
}
