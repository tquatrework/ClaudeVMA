import { useCallback, useState } from 'react'
import { fetchVisibilityPreferences, updateVisibilityPreferences } from '../../api/profile'
import type { VisibilityPreferences } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadVisibilityPreferences(
  userId: string | undefined,
  canAccess: boolean,
): Promise<VisibilityPreferences> {
  if (!userId || !canAccess) return pendingForever<VisibilityPreferences>()

  try {
    return await fetchVisibilityPreferences(userId)
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message =
      status === 403
        ? 'Accès refusé'
        : status === 404
          ? 'Préférences introuvables'
          : 'Erreur lors du chargement des préférences'
    throw { response: { data: { message } } }
  }
}

export interface UseProfileVisibilityResult {
  preferences: VisibilityPreferences | undefined
  isLoading: boolean
  loadError: string | null
  save: (payload: VisibilityPreferences) => Promise<boolean>
  isSaving: boolean
  saveError: string | null
}

/**
 * useProfileVisibility — charge les préférences de confidentialité d'un élève
 * (uniquement si `canAccess`) et expose l'action de sauvegarde.
 */
export function useProfileVisibility(
  userId: string | undefined,
  canAccess: boolean,
): UseProfileVisibilityResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadVisibilityPreferences(userId, canAccess),
    [userId, canAccess],
  )

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = useCallback(
    async (payload: VisibilityPreferences) => {
      if (!userId) return false
      setIsSaving(true)
      setSaveError(null)
      try {
        await updateVisibilityPreferences(userId, payload)
        return true
      } catch (caughtError) {
        setSaveError(getErrorMessage(caughtError, "Erreur lors de l'enregistrement"))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [userId],
  )

  return { preferences: data, isLoading, loadError, save, isSaving, saveError }
}
