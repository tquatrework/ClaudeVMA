/**
 * useAdminAvatarSettings — plafond d'envoi de la photo de profil, réglable par
 * le TI depuis « Paramètres système » (`SiteMetadataEditor`).
 *
 * Deux services distincts derrière un seul écran d'agrégation (arbitrage du
 * 2026-08-26, point 8) : cette photo appartient à `profile-service`, jamais à
 * `admin-observability-service` — d'où un hook et une route à part de
 * `updateSiteMetadata`.
 *
 * Lecture : `GET /profiles/avatar/constraints` (déjà utilisée côté profil,
 * contrat inchangé — seule `maxUploadBytes` intéresse cet écran).
 * Écriture : `PATCH /profiles/avatar/settings`, TI seul. La valeur affichée
 * après sauvegarde est celle **relue en base** par le serveur, jamais le
 * corps envoyé (règle du 2026-08-10, point 3bis).
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchProfileAvatarConstraints, updateProfileAvatarSettings } from '../../api/profile'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

/** Bornes serveur `[10000, 10000000]` octets (`docs/routes.md` § « Photo de profil »). */
export const AVATAR_MAX_UPLOAD_BYTES_MIN = 10_000
export const AVATAR_MAX_UPLOAD_BYTES_MAX = 10_000_000

const LOAD_FALLBACK_MESSAGE = 'Impossible de lire le plafond actuel de la photo de profil.'
const FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à modifier ce plafond."
const SAVE_FALLBACK_MESSAGE = "Le plafond n'a pas pu être enregistré. Réessayez."

function getBoundsErrorMessage(): string {
  return `La valeur doit être comprise entre ${AVATAR_MAX_UPLOAD_BYTES_MIN.toLocaleString('fr-FR')} et ${AVATAR_MAX_UPLOAD_BYTES_MAX.toLocaleString('fr-FR')} octets.`
}

export interface UseAdminAvatarSettingsResult {
  maxUploadBytes: number | null
  updatedAt: string | null
  isLoading: boolean
  loadError: string | null
  save: (nextMaxUploadBytes: number) => Promise<boolean>
  isSaving: boolean
  saveError: string | null
}

export function useAdminAvatarSettings(): UseAdminAvatarSettingsResult {
  const [maxUploadBytes, setMaxUploadBytes] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    setIsLoading(true)
    setLoadError(null)

    const loadConstraints = async () => {
      try {
        const constraints = await fetchProfileAvatarConstraints()
        if (isCancelled) return
        setMaxUploadBytes(constraints.maxUploadBytes)
      } catch (caughtError) {
        if (!isCancelled) setLoadError(getErrorMessage(caughtError, LOAD_FALLBACK_MESSAGE))
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void loadConstraints()

    return () => {
      isCancelled = true
    }
  }, [])

  const save = useCallback(async (nextMaxUploadBytes: number): Promise<boolean> => {
    setSaveError(null)

    if (
      !Number.isInteger(nextMaxUploadBytes) ||
      nextMaxUploadBytes < AVATAR_MAX_UPLOAD_BYTES_MIN ||
      nextMaxUploadBytes > AVATAR_MAX_UPLOAD_BYTES_MAX
    ) {
      setSaveError(getBoundsErrorMessage())
      return false
    }

    setIsSaving(true)
    try {
      const saved = await updateProfileAvatarSettings({ maxAvatarUploadBytes: nextMaxUploadBytes })
      // Réaffiche la réponse serveur (valeur relue en base), jamais le corps envoyé.
      setMaxUploadBytes(saved.maxAvatarUploadBytes)
      setUpdatedAt(saved.updatedAt)
      return true
    } catch (caughtError) {
      const status = getErrorStatus(caughtError)
      setSaveError(
        status === 403
          ? FORBIDDEN_MESSAGE
          : getErrorMessage(caughtError, SAVE_FALLBACK_MESSAGE),
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { maxUploadBytes, updatedAt, isLoading, loadError, save, isSaving, saveError }
}
