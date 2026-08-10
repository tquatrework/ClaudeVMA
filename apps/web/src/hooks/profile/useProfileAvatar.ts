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
 *
 * Le hook porte enfin le **contrôle de poids avant envoi**. Le plafond en
 * vigueur est bas (le reverse-proxy coupe à 1 Mio) alors qu'une photo de
 * téléphone pèse 3 à 8 Mo : la plupart des tentatives échoueraient. Un fichier
 * trop lourd est donc refusé **sans partir sur le réseau**, avec le même message
 * que celui du `413` — inutile de faire patienter l'utilisateur pour une réponse
 * qu'on connaît déjà.
 *
 * **Ce hook ne détient pas l'`avatarUrl`** (correction du 2026-08-10). Il l'a
 * gardée un temps dans son propre état, alors que c'est un champ du profil, donc
 * une donnée de la page. Monté dans un onglet, il la perdait au premier
 * démontage : la photo tout juste envoyée disparaissait au retour. La réponse
 * n'était pas de relire le profil — le serveur avait déjà renvoyé la nouvelle
 * URL dans la réponse du `POST` —, mais de la **remonter à son propriétaire**.
 * D'où `onAvatarUrlChange` : le hook annonce la valeur, la page la conserve et
 * la lui repasse en propriété. Aucun aller-retour réseau supplémentaire.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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
  getAvatarTooLargeMessage,
  getAvatarUploadErrorMessage,
} from '../../utils/profileAvatar'
import { isAvatarFileTooLarge } from '../../utils/profileAvatarConstraints'
import { useProfileAvatarConstraints } from './useProfileAvatarConstraints'
import type { ProfileAvatarConstraints } from '../../types/profile'

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
  /** Contraintes à annoncer avant le choix du fichier. Jamais `null`. */
  avatarConstraints: ProfileAvatarConstraints
}

export interface UseProfileAvatarOptions {
  /**
   * Le lecteur courant peut-il envoyer une photo ? Quand non, les contraintes
   * ne sont pas demandées au serveur : personne ne les lira.
   */
  canUpload?: boolean
  /**
   * Remonte au propriétaire de la donnée l'`avatarUrl` qui vaut désormais : celle
   * renvoyée par le serveur après un envoi, `null` après une suppression. C'est
   * la page qui la conserve et la repasse en propriété — sans quoi la photo ne
   * vivrait que dans cet écran-ci et disparaîtrait à son premier démontage.
   *
   * **Pas de relecture du profil ici** : la valeur est déjà connue, aller la
   * redemander serait un aller-retour pour rien.
   */
  onAvatarUrlChange?: (nextAvatarUrl: string | null) => void
}

/**
 * @param userId titulaire du profil consulté
 * @param avatarUrl champ `avatarUrl` du bloc `administrative`, tel que détenu par
 *   la page : URL de lecture versionnée, ou `null` (pas de photo, ou photo non
 *   partagée). **Propriété contrôlée** — ce hook ne la duplique pas dans son état
 *   et affiche exactement ce qu'on lui donne.
 * @param options `canUpload` — le lecteur est-il le titulaire ?
 */
export function useProfileAvatar(
  userId: string | undefined,
  avatarUrl: string | null | undefined,
  options: UseProfileAvatarOptions = {},
): UseProfileAvatarResult {
  const { avatarConstraints } = useProfileAvatarConstraints(options.canUpload ?? true)

  // Lu par référence : l'appelant n'a pas à mémoïser sa fonction pour éviter que
  // `uploadPhoto`/`removePhoto` ne changent d'identité à chaque rendu.
  const onAvatarUrlChangeRef = useRef(options.onAvatarUrlChange)
  onAvatarUrlChangeRef.current = options.onAvatarUrlChange

  const currentAvatarUrl = avatarUrl ?? null

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
      setUploadError(null)

      // Refus local : le fichier ne part pas. Envoyer 5 Mo pour se les faire
      // refuser ferait patienter l'utilisateur — plusieurs dizaines de secondes
      // en 4G — avant un message qu'on peut lui donner immédiatement.
      if (isAvatarFileTooLarge(file, avatarConstraints.maxUploadBytes)) {
        setUploadError(getAvatarTooLargeMessage(file.size, avatarConstraints.maxUploadBytes))
        return false
      }

      setIsUploadingPhoto(true)
      try {
        const { avatarUrl: nextAvatarUrl } = await uploadProfileAvatar(userId, file)
        // L'URL du serveur est remontée telle quelle à la page : son jeton `?v=`
        // est la seule chose qui garantit l'affichage de la NOUVELLE photo, et
        // c'est la page qui la conservera. Rien à redemander au serveur.
        onAvatarUrlChangeRef.current?.(nextAvatarUrl ?? null)
        return true
      } catch (caughtError) {
        // Filet de sécurité : le serveur peut refuser en `413` malgré le
        // contrôle local (contraintes non lues, ou plafond du proxy plus bas).
        setUploadError(
          getAvatarUploadErrorMessage(caughtError, {
            maxUploadBytes: avatarConstraints.maxUploadBytes,
            attemptedFileSizeBytes: file.size,
          }),
        )
        return false
      } finally {
        setIsUploadingPhoto(false)
      }
    },
    [userId, avatarConstraints.maxUploadBytes],
  )

  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const removePhoto = useCallback(async () => {
    if (!userId) return false
    setIsRemovingPhoto(true)
    setRemoveError(null)
    try {
      await deleteProfileAvatar(userId)
      // Symptôme inverse, même cause : sans cette remontée, la page garderait
      // l'URL de la photo supprimée et la ferait réapparaître.
      onAvatarUrlChangeRef.current?.(null)
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
    avatarConstraints,
  }
}
