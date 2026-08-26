/**
 * useAdminAttachmentSettings — réglages des pièces jointes du cahier de
 * texte, réglables par le TI depuis « Paramètres système » (`SiteMetadataEditor`).
 *
 * `pedagogical-log-service` reste propriétaire de ses propres réglages
 * (arbitrage du 2026-08-26, point 8) — domaine distinct de la photo de
 * profil, agrégé sur le même écran mais appelant son propre service.
 *
 * Lecture/écriture : `GET`/`PATCH /pedagogical-logs/settings/attachments`.
 * `PATCH` est une **mise à jour partielle** : seuls les champs modifiés sont
 * envoyés. La réponse serveur est réaffichée telle quelle après sauvegarde.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  fetchAttachmentSettings,
  updateAttachmentSettings,
  type PedagogicalLogAttachmentSettings,
  type UpdateAttachmentSettingsPayload,
} from '../../api/pedagogicalLogAttachments'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

const LOAD_FALLBACK_MESSAGE = 'Impossible de lire les réglages des pièces jointes.'
const FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à modifier ces réglages."
const SAVE_FALLBACK_MESSAGE = 'Les réglages n\'ont pas pu être enregistrés. Réessayez.'
const BOUNDS_MESSAGE = 'Le plafond par fichier ne peut pas dépasser le plafond total par entrée.'

export interface UseAdminAttachmentSettingsResult {
  settings: PedagogicalLogAttachmentSettings | null
  isLoading: boolean
  loadError: string | null
  save: (payload: UpdateAttachmentSettingsPayload) => Promise<boolean>
  isSaving: boolean
  saveError: string | null
}

export function useAdminAttachmentSettings(): UseAdminAttachmentSettingsResult {
  const [settings, setSettings] = useState<PedagogicalLogAttachmentSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    setIsLoading(true)
    setLoadError(null)

    const loadSettings = async () => {
      try {
        const current = await fetchAttachmentSettings()
        if (isCancelled) return
        setSettings(current)
      } catch (caughtError) {
        if (!isCancelled) setLoadError(getErrorMessage(caughtError, LOAD_FALLBACK_MESSAGE))
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void loadSettings()

    return () => {
      isCancelled = true
    }
  }, [])

  const save = useCallback(async (payload: UpdateAttachmentSettingsPayload): Promise<boolean> => {
    setSaveError(null)
    setIsSaving(true)
    try {
      const saved = await updateAttachmentSettings(payload)
      // Réaffiche la réponse serveur, jamais le corps envoyé.
      setSettings(saved)
      return true
    } catch (caughtError) {
      const status = getErrorStatus(caughtError)
      if (status === 403) {
        setSaveError(FORBIDDEN_MESSAGE)
      } else if (status === 400) {
        setSaveError(getErrorMessage(caughtError, BOUNDS_MESSAGE))
      } else {
        setSaveError(getErrorMessage(caughtError, SAVE_FALLBACK_MESSAGE))
      }
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { settings, isLoading, loadError, save, isSaving, saveError }
}
