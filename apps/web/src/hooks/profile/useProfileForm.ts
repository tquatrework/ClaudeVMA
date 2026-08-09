import { useCallback, useState } from 'react'
import {
  fetchProfile,
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../api/profile'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  PedagogicalProfileType,
  PrescriptionFields,
} from '../../types/profile'
import { useAsyncData } from '../useAsyncData'
import { getProfileReadErrorMessage, getProfileWriteErrorMessage } from '../../utils/profileErrors'
import { pickAdministrativeFields } from '../../utils/profileFields'

interface ProfileFormData {
  administrative: AdministrativeProfileFields
  /**
   * Bloc `pedagogical` brut de `GET /profiles/:userId` : sections déclarative et
   * prescription confondues, à plat. La séparation est faite au moment de
   * l'écriture, chaque section ayant sa route.
   * `null` = profil pédagogique jamais renseigné, état NORMAL.
   */
  pedagogical: Record<string, unknown> | null
  /** Forme annoncée par le serveur, `null` tant qu'aucun profil n'existe. */
  pedagogicalType: PedagogicalProfileType | null
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
      pedagogical: (profile.pedagogical ?? null) as Record<string, unknown> | null,
      pedagogicalType: profile.pedagogicalType ?? null,
    }
  } catch (caughtError) {
    throw { response: { data: { message: getProfileReadErrorMessage(caughtError) } } }
  }
}

export interface UseProfileFormResult {
  administrative: AdministrativeProfileFields | undefined
  pedagogical: Record<string, unknown> | null | undefined
  pedagogicalType: PedagogicalProfileType | null | undefined
  isLoading: boolean
  loadError: string | null
  saveAdministrative: (payload: AdministrativeProfileFields) => Promise<boolean>
  isSavingAdministrative: boolean
  administrativeSaveError: string | null
  savePedagogical: (payload: DeclarativePedagogicalFields) => Promise<boolean>
  isSavingPedagogical: boolean
  pedagogicalSaveError: string | null
  savePrescription: (payload: PrescriptionFields) => Promise<boolean>
  isSavingPrescription: boolean
  prescriptionSaveError: string | null
}

/**
 * useProfileForm — charge les données initiales du profil administratif et
 * pédagogique d'un utilisateur, et expose trois actions de sauvegarde
 * indépendantes, une par route d'écriture : administratif, section déclarative
 * du pédagogique, section prescription (RP seul).
 *
 * Chaque action a son propre cycle loading/error : un `403` sur la prescription
 * ne doit pas faire croire que l'enregistrement du profil déclaratif a échoué.
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

  const [isSavingPrescription, setIsSavingPrescription] = useState(false)
  const [prescriptionSaveError, setPrescriptionSaveError] = useState<string | null>(null)

  const saveAdministrative = useCallback(
    async (payload: AdministrativeProfileFields) => {
      if (!userId) return false
      setIsSavingAdministrative(true)
      setAdministrativeSaveError(null)
      try {
        await updateAdministrativeProfile(userId, payload)
        return true
      } catch (caughtError) {
        setAdministrativeSaveError(getProfileWriteErrorMessage(caughtError, 'administrative'))
        return false
      } finally {
        setIsSavingAdministrative(false)
      }
    },
    [userId],
  )

  const savePedagogical = useCallback(
    async (payload: DeclarativePedagogicalFields) => {
      if (!userId) return false
      setIsSavingPedagogical(true)
      setPedagogicalSaveError(null)
      try {
        await updatePedagogicalProfile(userId, payload)
        return true
      } catch (caughtError) {
        setPedagogicalSaveError(getProfileWriteErrorMessage(caughtError, 'declarative'))
        return false
      } finally {
        setIsSavingPedagogical(false)
      }
    },
    [userId],
  )

  const savePrescription = useCallback(
    async (payload: PrescriptionFields) => {
      if (!userId) return false
      setIsSavingPrescription(true)
      setPrescriptionSaveError(null)
      try {
        await updatePrescription(userId, payload)
        return true
      } catch (caughtError) {
        setPrescriptionSaveError(getProfileWriteErrorMessage(caughtError, 'prescription'))
        return false
      } finally {
        setIsSavingPrescription(false)
      }
    },
    [userId],
  )

  return {
    administrative: data?.administrative,
    pedagogical: data?.pedagogical,
    pedagogicalType: data?.pedagogicalType,
    isLoading,
    loadError,
    saveAdministrative,
    isSavingAdministrative,
    administrativeSaveError,
    savePedagogical,
    isSavingPedagogical,
    pedagogicalSaveError,
    savePrescription,
    isSavingPrescription,
    prescriptionSaveError,
  }
}
