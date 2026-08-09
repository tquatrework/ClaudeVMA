/**
 * useProfileSaveActions — les trois écritures de profil, sans chargement.
 *
 * Extrait de `useProfileForm` pour que la **fiche** (`ProfilePage`) puisse
 * enregistrer les champs saisis en place sans relire le profil une seconde fois :
 * elle l'a déjà chargé par `useProfileDetails`. Sans cette séparation, afficher
 * un formulaire sur la fiche aurait dupliqué l'appel `GET /profiles/:userId`.
 *
 * Une route d'écriture, un cycle loading/error : un `403` sur la prescription ne
 * doit pas faire croire que l'enregistrement du profil administratif a échoué.
 */

import { useCallback, useState } from 'react'
import {
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../api/profile'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  PrescriptionFields,
} from '../../types/profile'
import { getProfileWriteErrorMessage } from '../../utils/profileErrors'

export interface UseProfileSaveActionsResult {
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

export function useProfileSaveActions(userId: string | undefined): UseProfileSaveActionsResult {
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
