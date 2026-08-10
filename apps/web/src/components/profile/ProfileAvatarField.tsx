/**
 * ProfileAvatarField — emplacement de la photo, en tête du profil administratif.
 *
 * Il porte les trois usages d'un coup : voir la photo, la changer, la supprimer.
 * C'est le premier bloc de l'onglet, pas un bouton relégué sous un formulaire —
 * la photo est l'élément d'identité le plus immédiatement lisible d'une fiche.
 *
 * Substitut neutre : quand aucune image n'est affichable, on montre une pastille
 * d'initiales. Le serveur répond `404` aussi bien pour « pas de photo » que pour
 * « photo non partagée avec ce lecteur », et les rend volontairement
 * indiscernables : l'interface n'affirme donc ni l'un ni l'autre. Seul le
 * **titulaire** lit « Vous n'avez pas encore ajouté de photo » — pour lui,
 * l'absence n'a qu'une cause possible.
 *
 * Les actions ne sont proposées qu'au titulaire : `POST` et `DELETE` lui sont
 * réservés, sans exception administrative. Afficher un bouton qui répondrait
 * `403` est proscrit par la règle de filtrage UI du projet.
 *
 * **La limite d'envoi est annoncée avant le choix du fichier**, pas reléguée en
 * note grise sous le bouton. Elle est basse — le reverse-proxy coupe à 1 Mio —
 * alors qu'une photo de téléphone pèse 3 à 8 Mo : sans avertissement préalable,
 * la majorité des tentatives échoueraient et l'utilisateur ne comprendrait pas
 * pourquoi. La valeur affichée vient de `GET /profiles/avatar/constraints`,
 * jamais d'une constante : le jour où le plafond sera relevé, l'écran suivra.
 */

import React, { useId, useRef } from 'react'
import { useProfileAvatar } from '../../hooks/profile/useProfileAvatar'
import { getInitials } from '../../utils/role'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import {
  AVATAR_LABELS,
  getAvatarFormatsHint,
  getAvatarImageAlt,
  getAvatarMaxSizeHint,
} from '../../utils/profileAvatar'
import { buildAvatarFileInputAccept } from '../../utils/profileAvatarConstraints'
import { ErrorMessage } from '../ui/ErrorMessage'

const PHOTO_FRAME_CLASS =
  'w-24 h-24 rounded-full overflow-hidden shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center'

const ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors'

const DESTRUCTIVE_ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

/**
 * Encart des contraintes : surface claire bordée, texte de taille normale.
 * Volontairement pas une note `text-xs` grise — c'est l'information qui évite
 * l'échec, elle doit se lire avant le clic, pas après.
 */
const CONSTRAINTS_BOX_CLASS = 'mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3'

interface ProfileAvatarFieldProps {
  userId?: string
  /**
   * Champ `avatarUrl` du bloc `administrative`. **Propriété contrôlée** : ce
   * composant l'affiche, il ne la détient pas. Elle appartient à la page, qui la
   * tient du serveur puis des écritures signalées ci-dessous.
   */
  avatarUrl: string | null
  /**
   * Nom affiché à côté de la photo et repris dans le texte alternatif. Prénom et
   * nom uniquement : jamais d'identifiant technique, y compris en repli.
   */
  displayName?: string | null
  /** Le lecteur courant est-il le titulaire ? Lui seul change ou supprime. */
  canEdit: boolean
  /**
   * Annonce la nouvelle `avatarUrl` à son propriétaire : celle renvoyée par le
   * serveur après un envoi, `null` après une suppression.
   *
   * Garder cette valeur ici serait l'erreur corrigée le 2026-08-10 — une donnée
   * du profil détenue par un composant d'onglet, perdue à chaque démontage.
   */
  onAvatarUrlChange?: (nextAvatarUrl: string | null) => void
}

export function ProfileAvatarField({
  userId,
  avatarUrl,
  displayName,
  canEdit,
  onAvatarUrlChange,
}: ProfileAvatarFieldProps) {
  const fileInputId = useId()
  const constraintsHintId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    photoObjectUrl,
    isLoadingPhoto,
    loadError,
    uploadPhoto,
    isUploadingPhoto,
    uploadError,
    removePhoto,
    isRemovingPhoto,
    removeError,
    dismissWriteErrors,
    avatarConstraints,
  } = useProfileAvatar(userId, avatarUrl, { canUpload: canEdit, onAvatarUrlChange })

  const hasPhoto = photoObjectUrl !== null
  const isBusy = isUploadingPhoto || isRemovingPhoto

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    // Le champ est réinitialisé aussitôt : sans cela, resélectionner le MÊME
    // fichier après un refus ne déclencherait aucun `change`.
    event.target.value = ''
    if (!selectedFile) return
    await uploadPhoto(selectedFile)
  }

  const handleRemove = async () => {
    await removePhoto()
    // Le champ garde le focus utilisable après disparition du bouton supprimer.
    fileInputRef.current?.focus()
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {getProfileFieldLabel('avatarUrl')}
      </h2>

      {/*
        Alignement en haut : la colonne de droite porte l'encart des contraintes
        et devient plus haute que la vignette. Centrees, la photo et le nom ne
        seraient plus sur la meme ligne.
      */}
      <div className="flex items-start gap-5">
        <div className={PHOTO_FRAME_CLASS}>
          {hasPhoto ? (
            <img
              src={photoObjectUrl}
              alt={getAvatarImageAlt(displayName)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-2xl font-semibold text-gray-400"
              aria-hidden="true"
              data-testid="profile-avatar-initials"
            >
              {getInitials(displayName ?? '')}
            </span>
          )}
        </div>

        <div className="min-w-0">
          {displayName && (
            <p className="text-base font-medium text-gray-900 truncate">{displayName}</p>
          )}

          {isLoadingPhoto && <p className="text-sm text-gray-400">{AVATAR_LABELS.loading}</p>}

          {!isLoadingPhoto && !hasPhoto && canEdit && (
            <p className="text-sm text-gray-500">{AVATAR_LABELS.emptyForOwner}</p>
          )}

          {/*
            Les contraintes precedent les boutons : elles doivent etre lues avant
            le choix du fichier, pas decouvertes apres le refus.
          */}
          {canEdit && (
            <>
              <div className={CONSTRAINTS_BOX_CLASS} id={constraintsHintId}>
                <p className="text-sm text-gray-800">
                  <strong className="font-semibold">
                    {getAvatarMaxSizeHint(avatarConstraints.maxUploadBytes)}
                  </strong>{' '}
                  {getAvatarFormatsHint(avatarConstraints.acceptedContentTypes)}
                </p>
                <p className="mt-1 text-sm text-gray-600">{AVATAR_LABELS.reduceAdvice}</p>
                <p className="mt-1 text-xs text-gray-500">{AVATAR_LABELS.processingHint}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label
                  htmlFor={fileInputId}
                  className={`${ACTION_BUTTON_CLASS} ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {isUploadingPhoto
                    ? AVATAR_LABELS.uploading
                    : hasPhoto
                      ? AVATAR_LABELS.replaceAction
                      : AVATAR_LABELS.addAction}
                </label>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  accept={buildAvatarFileInputAccept(avatarConstraints.acceptedContentTypes)}
                  className="sr-only"
                  disabled={isBusy}
                  // Le champ est masqué visuellement : sans ce lien, un lecteur
                  // d'écran annoncerait le bouton sans jamais énoncer la limite.
                  aria-describedby={constraintsHintId}
                  onChange={handleFileSelected}
                />

                {hasPhoto && (
                  <button
                    type="button"
                    className={DESTRUCTIVE_ACTION_BUTTON_CLASS}
                    disabled={isBusy}
                    onClick={handleRemove}
                  >
                    {isRemovingPhoto ? AVATAR_LABELS.deleting : AVATAR_LABELS.deleteAction}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {loadError && <ErrorMessage message={loadError} className="mt-4" />}
      {uploadError && (
        <ErrorMessage message={uploadError} onClose={dismissWriteErrors} className="mt-4" />
      )}
      {removeError && (
        <ErrorMessage message={removeError} onClose={dismissWriteErrors} className="mt-4" />
      )}
    </section>
  )
}
