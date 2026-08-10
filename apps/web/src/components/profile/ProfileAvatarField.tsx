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
 */

import React, { useId, useRef } from 'react'
import { useProfileAvatar } from '../../hooks/profile/useProfileAvatar'
import { getInitials } from '../../utils/role'
import { getProfileFieldLabel } from '../../utils/profileFieldLabels'
import {
  AVATAR_FILE_INPUT_ACCEPT,
  AVATAR_LABELS,
  getAvatarImageAlt,
} from '../../utils/profileAvatar'
import { ErrorMessage } from '../ui/ErrorMessage'

const PHOTO_FRAME_CLASS =
  'w-24 h-24 rounded-full overflow-hidden shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center'

const ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors'

const DESTRUCTIVE_ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center text-sm font-medium px-4 py-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

interface ProfileAvatarFieldProps {
  userId?: string
  /** Champ `avatarUrl` du bloc `administrative`, tel que reçu du serveur. */
  avatarUrl: string | null
  /**
   * Nom affiché à côté de la photo et repris dans le texte alternatif. Prénom et
   * nom uniquement : jamais d'identifiant technique, y compris en repli.
   */
  displayName?: string | null
  /** Le lecteur courant est-il le titulaire ? Lui seul change ou supprime. */
  canEdit: boolean
}

export function ProfileAvatarField({
  userId,
  avatarUrl,
  displayName,
  canEdit,
}: ProfileAvatarFieldProps) {
  const fileInputId = useId()
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
  } = useProfileAvatar(userId, avatarUrl)

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

      <div className="flex items-center gap-5">
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

          {canEdit && (
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
                accept={AVATAR_FILE_INPUT_ACCEPT}
                className="sr-only"
                disabled={isBusy}
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
          )}

          {canEdit && <p className="mt-2 text-xs text-gray-400">{AVATAR_LABELS.formatsHint}</p>}
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
