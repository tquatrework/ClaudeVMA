/**
 * useProfileAvatar — affichage, remplacement et suppression de la photo de profil.
 *
 * Deux contraintes structurent ce hook :
 *
 * 1. **La photo ne peut pas être posée dans un `<img src>`.** La route de lecture
 *    est authentifiée par le JWT de l'en-tête `Authorization`, que le navigateur
 *    n'envoie jamais sur une balise `<img>`. On récupère donc les octets par
 *    requête, puis on en fabrique un object URL — qui doit être **révoqué** au
 *    démontage et à chaque remplacement, sinon chaque navigation laisse un blob
 *    en mémoire.
 * 2. **Le jeton `?v=` fait autorité.** Après un envoi, on repart de l'`avatarUrl`
 *    renvoyé par le serveur : son horodatage change à chaque remplacement, et
 *    c'est lui qui empêche le navigateur de resservir l'ancienne photo.
 *
 * Le `404` n'est pas une erreur : il vaut « pas de photo » **ou** « photo masquée
 * pour ce lecteur », deux états que le serveur rend volontairement
 * indiscernables. Il se traduit par une absence d'image, jamais par un message
 * qui affirmerait l'une des deux causes.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  deleteProfileAvatar,
  fetchProfileAvatarBlob,
  uploadProfileAvatar,
} from '../../api/profile'
import { getErrorStatus } from '../../utils/apiError'
import {
  extractAvatarVersionToken,
  getAvatarDeleteErrorMessage,
  getAvatarLoadErrorMessage,
  getAvatarUploadErrorMessage,
} from '../../utils/profileAvatar'

export interface UseProfileAvatarResult {
  /** Object URL de la photo affichable, `null` quand il n'y en a aucune. */
  photoObjectUrl: string | null
  isLoadingPhoto: boolean
  /** Échec d'affichage — jamais un `404`, qui vaut absence de photo. */
  loadError: string | null
  uploadPhoto: (file: File) => Promise<boolean>
  isUploadingPhoto: boolean
  uploadError: string | null
  removePhoto: () => Promise<boolean>
  isRemovingPhoto: boolean
  removeError: string | null
  /** Efface les messages d'échec d'écriture (nouvelle tentative de l'utilisateur). */
  dismissWriteErrors: () => void
}

/**
 * @param userId titulaire du profil consulté
 * @param avatarUrl champ `avatarUrl` du bloc `administrative`, tel que reçu :
 *   URL de lecture versionnée, ou `null` (pas de photo, ou photo non partagée)
 */
export function useProfileAvatar(
  userId: string | undefined,
  avatarUrl: string | null | undefined,
): UseProfileAvatarResult {
  /**
   * URL courante : celle du profil chargé, puis celle renvoyée par le serveur
   * après un envoi ou une suppression. Sans cet état local, la fiche continuerait
   * d'afficher l'ancienne version tant qu'elle n'est pas rechargée.
   */
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl ?? null)
  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl ?? null)
  }, [avatarUrl])

  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null)
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !currentAvatarUrl) {
      setPhotoObjectUrl(null)
      setIsLoadingPhoto(false)
      setLoadError(null)
      return
    }

    let isCancelled = false
    let createdObjectUrl: string | null = null

    // Le nettoyage de l'effet précédent a déjà révoqué l'object URL d'avant : on
    // repart d'une image absente pour ne jamais rendre une source révoquée.
    setPhotoObjectUrl(null)
    setIsLoadingPhoto(true)
    setLoadError(null)

    // Fonction interne plutôt que chaîne de promesses : une erreur levée
    // *avant* la promesse (transport indisponible) remonterait sinon dans le
    // corps de l'effet, où React la transforme en écran blanc. Une photo
    // introuvable ne doit jamais faire tomber la fiche.
    const loadPhoto = async () => {
      try {
        const photoBlob = await fetchProfileAvatarBlob(
          userId,
          extractAvatarVersionToken(currentAvatarUrl),
        )
        if (isCancelled) return
        createdObjectUrl = URL.createObjectURL(photoBlob)
        setPhotoObjectUrl(createdObjectUrl)
      } catch (caughtError) {
        if (isCancelled) return
        // Pas de photo, ou photo masquée : une absence, pas une panne.
        if (getErrorStatus(caughtError) === 404) return
        setLoadError(getAvatarLoadErrorMessage(caughtError))
      } finally {
        if (!isCancelled) setIsLoadingPhoto(false)
      }
    }

    void loadPhoto()

    return () => {
      isCancelled = true
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl)
    }
  }, [userId, currentAvatarUrl])

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (!userId) return false
      setIsUploadingPhoto(true)
      setUploadError(null)
      try {
        const { avatarUrl: nextAvatarUrl } = await uploadProfileAvatar(userId, file)
        // On réutilise l'URL du serveur telle quelle : son jeton `?v=` est la
        // seule chose qui garantit l'affichage de la NOUVELLE photo.
        setCurrentAvatarUrl(nextAvatarUrl ?? null)
        return true
      } catch (caughtError) {
        setUploadError(getAvatarUploadErrorMessage(caughtError))
        return false
      } finally {
        setIsUploadingPhoto(false)
      }
    },
    [userId],
  )

  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const removePhoto = useCallback(async () => {
    if (!userId) return false
    setIsRemovingPhoto(true)
    setRemoveError(null)
    try {
      await deleteProfileAvatar(userId)
      setCurrentAvatarUrl(null)
      return true
    } catch (caughtError) {
      setRemoveError(getAvatarDeleteErrorMessage(caughtError))
      return false
    } finally {
      setIsRemovingPhoto(false)
    }
  }, [userId])

  const dismissWriteErrors = useCallback(() => {
    setUploadError(null)
    setRemoveError(null)
  }, [])

  return {
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
  }
}
