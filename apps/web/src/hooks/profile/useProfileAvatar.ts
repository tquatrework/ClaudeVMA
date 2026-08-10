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
 * **L'état local ne suffit pas** (défaut du 2026-08-10). Ce hook est monté dans
 * l'onglet administratif : quitter l'onglet le démonte, y revenir le remonte avec
 * l'`avatarUrl` du profil chargé **avant** l'envoi. Après une écriture réussie,
 * il prévient donc son appelant (`onAvatarChanged`) pour que la page relise sa
 * source de vérité — l'écran ne doit jamais afficher durablement une donnée que
 * le serveur contredit.
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
   * Appelé après un envoi **ou** une suppression réussis, pour que la page
   * relise `GET /profiles/:userId`. Sans lui, la nouvelle photo ne vit que dans
   * l'état local de ce hook : elle disparaît au premier démontage (changement
   * d'onglet, retour sur la page), et la précédente ressuscite après une
   * suppression. La relecture doit rester ciblée — surtout pas un rechargement
   * complet de la page, qui effacerait la saisie en cours du formulaire.
   */
  onAvatarChanged?: () => void
}

/**
 * @param userId titulaire du profil consulté
 * @param avatarUrl champ `avatarUrl` du bloc `administrative`, tel que reçu :
 *   URL de lecture versionnée, ou `null` (pas de photo, ou photo non partagée)
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
  const onAvatarChangedRef = useRef(options.onAvatarChanged)
  onAvatarChangedRef.current = options.onAvatarChanged

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
        // On réutilise l'URL du serveur telle quelle : son jeton `?v=` est la
        // seule chose qui garantit l'affichage de la NOUVELLE photo.
        setCurrentAvatarUrl(nextAvatarUrl ?? null)
        // Puis on demande à la page de relire le profil : cet état local ne
        // survit pas au démontage de l'onglet.
        onAvatarChangedRef.current?.()
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
      setCurrentAvatarUrl(null)
      // Symptôme inverse, même cause : sans relecture, la page garderait l'URL
      // de la photo supprimée et la ferait réapparaître au prochain montage.
      onAvatarChangedRef.current?.()
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
