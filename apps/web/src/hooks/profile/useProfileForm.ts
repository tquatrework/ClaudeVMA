import { useCallback, useState } from 'react'
import { fetchProfile, updateAdministrativeProfile, updatePedagogicalProfile } from '../../api/profile'
import type { AdministrativeProfileFields, PedagogicalProfileFields } from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'
import { pickAdministrativeFields } from '../../utils/profileFields'

interface ProfileFormData {
  administrative: AdministrativeProfileFields
  /**
   * Bloc `pedagogical` brut de `GET /profiles/:userId`. Sa forme (élève ou
   * formateur) n'est connue qu'après résolution par
   * `resolvePedagogicalProfileKind` : il reste donc non typé à ce niveau.
   * `null` = profil pédagogique jamais renseigné, état NORMAL.
   */
  pedagogical: Record<string, unknown> | null
}

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadProfileFormData(userId: string | undefined): Promise<ProfileFormData> {
  if (!userId) return pendingForever<ProfileFormData>()

  try {
    const profile = await fetchProfile(userId)
    return {
      // `administrative` / `pedagogical` : clés courtes de GET /profiles/:userId.
      // Le bloc administratif est filtré sur les champs réacceptés en écriture :
      // le formulaire le renvoie intégralement au PUT, et tout champ inconnu y
      // déclencherait un 400 (forbidNonWhitelisted).
      administrative: pickAdministrativeFields(profile.administrative),
      // `pedagogical: null` (profil non encore renseigné) est un état NORMAL,
      // conservé tel quel : il sert à déterminer la forme du profil à éditer.
      pedagogical: (profile.pedagogical ?? null) as Record<string, unknown> | null,
    }
  } catch (caughtError) {
    const status = getErrorStatus(caughtError)
    const message = status === 403 ? 'Accès refusé' : 'Impossible de charger le profil'
    throw { response: { data: { message } } }
  }
}

export interface UseProfileFormResult {
  administrative: AdministrativeProfileFields | undefined
  pedagogical: Record<string, unknown> | null | undefined
  isLoading: boolean
  loadError: string | null
  saveAdministrative: (payload: AdministrativeProfileFields) => Promise<boolean>
  isSavingAdministrative: boolean
  administrativeSaveError: string | null
  savePedagogical: (payload: PedagogicalProfileFields) => Promise<boolean>
  isSavingPedagogical: boolean
  pedagogicalSaveError: string | null
}

/**
 * useProfileForm — charge les données initiales du profil administratif et
 * pédagogique d'un utilisateur, et expose deux actions de sauvegarde
 * indépendantes (chaque onglet a son propre cycle loading/error, à l'image de
 * useAccountManagement pour changeStatus/regenerateAccess).
 */
export function useProfileForm(userId: string | undefined): UseProfileFormResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => loadProfileFormData(userId),
    [userId],
  )

  const [isSavingAdministrative, setIsSavingAdministrative] = useState(false)
  const [administrativeSaveError, setAdministrativeSaveError] = useState<string | null>(null)

  const [isSavingPedagogical, setIsSavingPedagogical] = useState(false)
  const [pedagogicalSaveError, setPedagogicalSaveError] = useState<string | null>(null)

  const saveAdministrative = useCallback(
    async (payload: AdministrativeProfileFields) => {
      if (!userId) return false
      setIsSavingAdministrative(true)
      setAdministrativeSaveError(null)
      try {
        await updateAdministrativeProfile(userId, payload)
        return true
      } catch (caughtError) {
        setAdministrativeSaveError(getErrorMessage(caughtError, 'Erreur lors de la sauvegarde'))
        return false
      } finally {
        setIsSavingAdministrative(false)
      }
    },
    [userId],
  )

  const savePedagogical = useCallback(
    async (payload: PedagogicalProfileFields) => {
      if (!userId) return false
      setIsSavingPedagogical(true)
      setPedagogicalSaveError(null)
      try {
        await updatePedagogicalProfile(userId, payload)
        return true
      } catch (caughtError) {
        setPedagogicalSaveError(getErrorMessage(caughtError, 'Erreur lors de la sauvegarde'))
        return false
      } finally {
        setIsSavingPedagogical(false)
      }
    },
    [userId],
  )

  return {
    administrative: data?.administrative,
    pedagogical: data?.pedagogical,
    isLoading,
    loadError,
    saveAdministrative,
    isSavingAdministrative,
    administrativeSaveError,
    savePedagogical,
    isSavingPedagogical,
    pedagogicalSaveError,
  }
}
