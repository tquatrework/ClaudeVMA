/**
 * useAdminNotebookAccessSettings — réglages d'accès admin/parent au carnet
 * personnel, réglables par le TI depuis « Paramètres système »
 * (`SiteMetadataEditor`).
 *
 * `pedagogical-log-service` reste propriétaire de ses propres réglages
 * (même précédent que `useAdminAttachmentSettings`, arbitrage du 2026-08-26,
 * point 8) — domaine distinct des autres sections de cet écran.
 *
 * Lecture/écriture : `GET`/`PATCH /pedagogical-logs/settings/notebook-access`.
 * `PATCH` est une **mise à jour partielle** : seuls les champs modifiés sont
 * envoyés. La réponse serveur est réaffichée telle quelle après sauvegarde.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  fetchNotebookAccessSettings,
  updateNotebookAccessSettings,
  type NotebookAccessSettings,
  type UpdateNotebookAccessSettingsPayload,
} from '../../api/pedagogicalLogNotebookAccess'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

const LOAD_FALLBACK_MESSAGE = "Impossible de lire les réglages d'accès au carnet personnel."
const FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à modifier ces réglages."
const SAVE_FALLBACK_MESSAGE = "Les réglages n'ont pas pu être enregistrés. Réessayez."

export interface UseAdminNotebookAccessSettingsResult {
  settings: NotebookAccessSettings | null
  isLoading: boolean
  loadError: string | null
  save: (payload: UpdateNotebookAccessSettingsPayload) => Promise<boolean>
  isSaving: boolean
  saveError: string | null
}

export function useAdminNotebookAccessSettings(): UseAdminNotebookAccessSettingsResult {
  const [settings, setSettings] = useState<NotebookAccessSettings | null>(null)
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
        const current = await fetchNotebookAccessSettings()
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

  const save = useCallback(
    async (payload: UpdateNotebookAccessSettingsPayload): Promise<boolean> => {
      setSaveError(null)
      setIsSaving(true)
      try {
        const saved = await updateNotebookAccessSettings(payload)
        // Réaffiche la réponse serveur, jamais le corps envoyé.
        setSettings(saved)
        return true
      } catch (caughtError) {
        const status = getErrorStatus(caughtError)
        if (status === 403) {
          setSaveError(FORBIDDEN_MESSAGE)
        } else {
          setSaveError(getErrorMessage(caughtError, SAVE_FALLBACK_MESSAGE))
        }
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  return { settings, isLoading, loadError, save, isSaving, saveError }
}
