/**
 * useAttachmentSettings — réglages courants des pièces jointes du cahier de
 * texte, lus au serveur (`GET /pedagogical-logs/settings/attachments`).
 *
 * Même rôle que `useProfileAvatarConstraints` pour la photo de profil : lu
 * **avant** d'afficher le bouton « Joindre un fichier », pour (1) savoir si la
 * fonctionnalité est activée et (2) annoncer/contrôler localement le plafond
 * par fichier avant l'envoi. Aucune valeur codée en dur côté front.
 */

import { useEffect, useState } from 'react'
import { fetchAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import type { PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'

/**
 * Repli utilisé uniquement si l'appel échoue — reprend les valeurs par défaut
 * documentées (`docs/routes.md` § « Liens et pièces jointes »). Activé par
 * défaut : bloquer l'ajout de pièce jointe sur une simple panne réseau serait
 * plus gênant qu'annoncer un plafond peut-être légèrement inexact.
 */
export const FALLBACK_ATTACHMENT_SETTINGS: PedagogicalLogAttachmentSettings = {
  id: '',
  attachmentsEnabled: true,
  maxFileBytes: 100_000,
  maxTotalBytesPerEntry: 5_000_000,
  updatedAt: '',
}

export interface UseAttachmentSettingsResult {
  /** Toujours exploitable : valeurs du serveur, ou repli. Jamais `null`. */
  attachmentSettings: PedagogicalLogAttachmentSettings
  isLoadingAttachmentSettings: boolean
}

/**
 * @param isEnabled `false` pour ne pas appeler le serveur (ex. lecteur qui ne
 *   peut de toute façon pas écrire) — inutile de lire un réglage que personne
 *   n'utilisera.
 */
export function useAttachmentSettings(isEnabled = true): UseAttachmentSettingsResult {
  const [attachmentSettings, setAttachmentSettings] = useState<PedagogicalLogAttachmentSettings>(
    FALLBACK_ATTACHMENT_SETTINGS,
  )
  const [isLoadingAttachmentSettings, setIsLoadingAttachmentSettings] = useState(isEnabled)

  useEffect(() => {
    if (!isEnabled) {
      setIsLoadingAttachmentSettings(false)
      return
    }

    let isCancelled = false
    setIsLoadingAttachmentSettings(true)

    const loadSettings = async () => {
      try {
        const serverSettings = await fetchAttachmentSettings()
        if (isCancelled) return
        setAttachmentSettings(serverSettings)
      } catch (caughtError) {
        if (!isCancelled) {
          console.warn('[pedagogical-log] réglages des pièces jointes illisibles :', caughtError)
        }
      } finally {
        if (!isCancelled) setIsLoadingAttachmentSettings(false)
      }
    }

    void loadSettings()

    return () => {
      isCancelled = true
    }
  }, [isEnabled])

  return { attachmentSettings, isLoadingAttachmentSettings }
}
