/**
 * AdministrativeProfilePanel — bloc administratif de la fiche profil.
 *
 * En tête, l'**emplacement de la photo** (`ProfileAvatarField`) : la voir, la
 * changer, la supprimer. Il a ses propres routes et son propre droit d'écriture
 * — le titulaire seul —, d'où un `canEditAvatar` distinct de `canEdit`.
 *
 * Dessous, deux rendus, un seul contenu : **les 11 champs du contrat, toujours
 * tous**.
 *
 * - lecteur **sans** droit d'écriture → liste de lecture, un champ vide portant
 *   « Non renseigné » (à ne pas confondre avec « Non partagé », qui dit que le
 *   titulaire ne montre pas ce champ à ce lecteur) ;
 * - lecteur **avec** droit d'écriture → les mêmes champs, en saisie. Un champ
 *   qu'on ne voit pas est un champ qu'on ne peut pas renseigner : sur des profils
 *   réels où presque tout est vide, une fiche qui n'affiche que ce qui est rempli
 *   n'offre aucun moyen de la compléter (constat du 2026-08-09).
 *
 * La traçabilité (`createdAt` / `updatedAt`) reste en lecture des deux côtés :
 * elle est posée par le serveur, l'envoyer vaudrait `400`.
 *
 * Une fiche **filtrée** repasse en lecture seule : le bloc y est amputé des
 * champs non partagés, et un formulaire construit sur un bloc incomplet
 * inviterait à réécrire ce qu'on n'a pas le droit de voir.
 */

import React, { useMemo, useState } from 'react'
import type { ProfileVisibility, SavedProfileBlock } from '../../types/profile'
import {
  ADMINISTRATIVE_DISPLAY_FIELD_NAMES,
  ADMINISTRATIVE_TRACEABILITY_FIELD_NAMES,
  pickAdministrativeDisplayFields,
  pickAdministrativeFields,
} from '../../utils/profileFields'
import { formatFullName } from '../../utils/nameFormat'
import { isEmptyFieldValue } from '../../utils/profileFieldDisplay'
import { isProfileFiltered, pickHiddenFieldNames } from '../../utils/profileVisibility'
import { useProfileSaveActions } from '../../hooks/profile/useProfileSaveActions'
import { AdministrativeProfileForm } from './AdministrativeProfileForm'
import { EditableProfileCard } from './EditableProfileCard'
import { ProfileAvatarField } from './ProfileAvatarField'
import { ProfileFieldList } from './ProfileFieldList'
import { ProfileSection } from './ProfileSection'

const SECTION_TITLE = 'Informations administratives'

const EDIT_DESCRIPTION =
  'Complétez ou corrigez vos informations : tous les champs sont modifiables, ' +
  'et ceux que vous laissez vides restent simplement non renseignés.'

const SAVE_SUCCESS_MESSAGE = 'Profil administratif mis à jour'

interface AdministrativeProfilePanelProps {
  userId?: string
  /** Bloc `administrative` de `GET /profiles/:userId`, tel quel. */
  administrative?: Record<string, unknown> | null
  visibility?: ProfileVisibility
  /** Le lecteur courant a-t-il le droit d'écrire ce profil ? */
  canEdit: boolean
  /**
   * Le lecteur courant est-il le **titulaire** ? Droit distinct et plus
   * restreint que `canEdit` : la photo n'est changée que par son propriétaire,
   * même quand un RP ou un TI peut modifier le reste du bloc.
   */
  canEditAvatar: boolean
  /**
   * `avatarUrl` **détenue par la page**, pas extraite ici du bloc reçu : la photo
   * a ses propres routes d'écriture, et la valeur qui fait foi après un envoi est
   * celle que le serveur vient de renvoyer, conservée en haut de l'écran.
   */
  avatarUrl: string | null
  /** Remonte la nouvelle `avatarUrl` à la page (envoi ou suppression réussis). */
  onAvatarUrlChange?: (nextAvatarUrl: string | null) => void
  /**
   * Remonte à la page le bloc administratif **renvoyé par le serveur** après un
   * enregistrement. Même raison que pour la photo : le bloc affiché appartient à
   * la fiche, pas à ce panneau. Sans ce signal, la page continuerait d'afficher
   * les valeurs d'avant l'écriture — nom de la photo et traçabilité compris —
   * jusqu'au prochain chargement.
   */
  onSaved?: (savedBlock: SavedProfileBlock) => void
}

export function AdministrativeProfilePanel({
  userId,
  administrative,
  visibility,
  canEdit,
  canEditAvatar,
  avatarUrl,
  onAvatarUrlChange,
  onSaved,
}: AdministrativeProfilePanelProps) {
  const { saveAdministrative, isSavingAdministrative, administrativeSaveError } =
    useProfileSaveActions(userId, { onAdministrativeSaved: onSaved })

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Identité stable indispensable : le formulaire réinitialise ses valeurs de
  // saisie à chaque nouveau bloc source. Recalculé à chaque rendu, il effacerait
  // la frappe en cours.
  const editableFields = useMemo(
    () => pickAdministrativeFields(administrative),
    [administrative],
  )
  const displayedFields = useMemo(
    () => pickAdministrativeDisplayFields(administrative),
    [administrative],
  )

  const hiddenFieldNames = pickHiddenFieldNames(ADMINISTRATIVE_DISPLAY_FIELD_NAMES, visibility)

  const isEditable = canEdit && !isProfileFiltered(visibility)

  /**
   * Emplacement de la photo, en tête du bloc dans les deux rendus. Il est monté
   * même en lecture seule : une fiche d'identité sans visage n'en est pas une, et
   * le lecteur autorisé doit voir la photo qu'il a le droit de voir.
   */
  const avatarField = (
    <ProfileAvatarField
      userId={userId}
      avatarUrl={avatarUrl}
      displayName={formatFullName(
        typeof displayedFields.firstName === 'string' ? displayedFields.firstName : undefined,
        typeof displayedFields.lastName === 'string' ? displayedFields.lastName : undefined,
      )}
      canEdit={canEditAvatar}
      onAvatarUrlChange={onAvatarUrlChange}
    />
  )

  if (!isEditable) {
    return (
      <>
        {avatarField}
        <ProfileSection
          title={SECTION_TITLE}
          data={displayedFields}
          fieldNames={ADMINISTRATIVE_DISPLAY_FIELD_NAMES}
          emptyMessage="Aucune donnée administrative"
          hiddenFieldNames={hiddenFieldNames}
        />
      </>
    )
  }

  const handleSubmit = async (payload: Parameters<typeof saveAdministrative>[0]) => {
    setSuccessMessage(null)
    const isSaved = await saveAdministrative(payload)
    if (isSaved) setSuccessMessage(SAVE_SUCCESS_MESSAGE)
  }

  // La traçabilité n'est affichée que si le serveur l'a réellement posée : deux
  // lignes « Non renseigné » sous un formulaire n'apprendraient rien.
  const hasTraceability = ADMINISTRATIVE_TRACEABILITY_FIELD_NAMES.some(
    (fieldName) => !isEmptyFieldValue(displayedFields[fieldName]),
  )

  return (
    <>
      {avatarField}

      <EditableProfileCard
        title={SECTION_TITLE}
        description={EDIT_DESCRIPTION}
        successMessage={successMessage}
        onDismissSuccess={() => setSuccessMessage(null)}
        saveError={administrativeSaveError}
      >
        <AdministrativeProfileForm
          profile={editableFields}
          isSaving={isSavingAdministrative}
          onSubmit={handleSubmit}
          className="space-y-4"
        />

        {hasTraceability && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <ProfileFieldList
              data={displayedFields}
              fieldNames={ADMINISTRATIVE_TRACEABILITY_FIELD_NAMES}
              className="space-y-2"
            />
          </div>
        )}
      </EditableProfileCard>
    </>
  )
}
