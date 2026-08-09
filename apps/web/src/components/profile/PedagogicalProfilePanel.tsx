/**
 * PedagogicalProfilePanel — profil pédagogique de la fiche, en deux sections
 * clairement séparées bien que le serveur les renvoie à plat :
 *
 * 1. ce que le titulaire a déclaré sur lui-même — saisissable par lui ;
 * 2. ce que le responsable pédagogique a prescrit *sur* lui, attribué et daté —
 *    **toujours en lecture** ici, quel que soit le lecteur : un élève ne rédige
 *    pas ses préconisations, un formateur pas ses résultats de test.
 *
 * La séparation est une question de sens, pas de mise en page : le titulaire doit
 * voir d'un coup d'œil ce qui vient de lui et ce qui vient d'un tiers.
 *
 * Un profil pédagogique **inexistant** (`pedagogical: null`, `pedagogicalType:
 * null` — état normal, ce profil étant facultatif) n'est plus une impasse : dès
 * que la forme du profil est connue (annoncée par le serveur, ou déduite du rôle
 * du titulaire), la section déclarative s'affiche vide et prête à être remplie.
 */

import React, { useState } from 'react'
import type {
  DeclarativePedagogicalFields,
  PedagogicalProfileKind,
  ProfileVisibility,
} from '../../types/profile'
import { declarativeDisplayFieldNames, pickDeclarativeDisplayFields } from '../../utils/profileFields'
import { isProfileFiltered, pickHiddenFieldNames } from '../../utils/profileVisibility'
import { useProfileSaveActions } from '../../hooks/profile/useProfileSaveActions'
import { EditableProfileCard } from './EditableProfileCard'
import { PedagogicalProfileForm } from './PedagogicalProfileForm'
import { ProfileSection } from './ProfileSection'
import { PrescriptionPanel } from './PrescriptionPanel'
import { UndeterminedPedagogicalProfileNotice } from './UndeterminedPedagogicalProfileNotice'

const SECTION_TITLE = 'Informations déclarées'

const SAVE_SUCCESS_MESSAGE = 'Profil pédagogique mis à jour'

interface PedagogicalProfilePanelProps {
  pedagogicalKind: PedagogicalProfileKind
  pedagogical: Record<string, unknown> | null
  /** Bloc `visibility` de la lecture — absent quand la fiche est entière. */
  visibility?: ProfileVisibility
  userId?: string
  /** Le lecteur courant peut-il écrire la section déclarative ? */
  canEdit?: boolean
}

function describeSection(pedagogicalKind: PedagogicalProfileKind): string {
  return pedagogicalKind === 'teacher'
    ? 'Ce que le formateur déclare sur son enseignement.'
    : "Ce que l'élève déclare sur sa scolarité."
}

export function PedagogicalProfilePanel({
  pedagogicalKind,
  pedagogical,
  visibility,
  userId,
  canEdit = false,
}: PedagogicalProfilePanelProps) {
  const { savePedagogical, isSavingPedagogical, pedagogicalSaveError } =
    useProfileSaveActions(userId)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (pedagogicalKind === 'unknown') {
    return <UndeterminedPedagogicalProfileNotice />
  }

  const handleSubmit = async (payload: DeclarativePedagogicalFields) => {
    setSuccessMessage(null)
    const isSaved = await savePedagogical(payload)
    if (isSaved) setSuccessMessage(SAVE_SUCCESS_MESSAGE)
  }

  // Une fiche filtrée est amputée : un formulaire bâti dessus proposerait de
  // réécrire des champs que le lecteur n'a pas le droit de voir.
  const isEditable = canEdit && !isProfileFiltered(visibility)

  return (
    <div className="space-y-6">
      {isEditable ? (
        <EditableProfileCard
          title={SECTION_TITLE}
          description={describeSection(pedagogicalKind)}
          successMessage={successMessage}
          onDismissSuccess={() => setSuccessMessage(null)}
          saveError={pedagogicalSaveError}
        >
          <PedagogicalProfileForm
            pedagogicalType={pedagogicalKind}
            profile={pedagogical}
            isSaving={isSavingPedagogical}
            onSubmit={handleSubmit}
            className="space-y-4"
          />
        </EditableProfileCard>
      ) : (
        <ProfileSection
          title={SECTION_TITLE}
          description={describeSection(pedagogicalKind)}
          data={pickDeclarativeDisplayFields(pedagogicalKind, pedagogical)}
          fieldNames={declarativeDisplayFieldNames(pedagogicalKind)}
          emptyMessage="Profil pédagogique non renseigné"
          hiddenFieldNames={pickHiddenFieldNames(
            declarativeDisplayFieldNames(pedagogicalKind),
            visibility,
          )}
        />
      )}

      <PrescriptionPanel
        pedagogicalType={pedagogicalKind}
        pedagogical={pedagogical}
        visibility={visibility}
      />
    </div>
  )
}
