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
 *
 * **Chaque écriture rend sa réponse à l'écran** (généralisation du 2026-08-10).
 * Les trois routes renvoient la ressource à jour ; ce hook jetait cette réponse
 * et se contentait d'un `return true`, si bien que la page continuait d'afficher
 * les valeurs d'avant l'enregistrement — exactement le défaut corrigé pour la
 * photo, généralisé à tous les champs. Les rappels ci-dessous transmettent la
 * réponse **du serveur** à qui détient l'état ; le corps envoyé n'est jamais
 * réinjecté à sa place.
 */

import { useCallback, useRef, useState } from 'react'
import {
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../api/profile'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  PrescriptionFields,
  SavedProfileBlock,
} from '../../types/profile'
import { getProfileWriteErrorMessage } from '../../utils/profileErrors'
import { isUsableSavedBlock } from '../../utils/profileMerge'

/**
 * Rappels de propagation — un par route, car les réponses n'ont ni la même forme
 * ni la même destination : bloc administratif d'un côté, bloc pédagogique de
 * l'autre (déclaratif et prescription visant le même bloc, à plat).
 */
export interface ProfileSaveHandlers {
  /** Bloc administratif à jour, à plat : `{userId, ...champsAdmin}`. */
  onAdministrativeSaved?: (savedBlock: SavedProfileBlock) => void
  /** Section déclarative à jour, à plat : `{userId, ...champsPedago}`. */
  onPedagogicalSaved?: (savedBlock: SavedProfileBlock) => void
  /** Profil pédagogique complet, `filledBy`/`filledAt` posés par le serveur. */
  onPrescriptionSaved?: (savedBlock: SavedProfileBlock) => void
}

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

export function useProfileSaveActions(
  userId: string | undefined,
  handlers: ProfileSaveHandlers = {},
): UseProfileSaveActionsResult {
  /**
   * Les rappels sont lus au moment de l'appel, jamais capturés dans les
   * dépendances : un parent qui en recrée un à chaque rendu ne doit pas
   * réinstancier les fonctions d'enregistrement — les formulaires les reçoivent
   * en propriété.
   */
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

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
        const savedBlock = await updateAdministrativeProfile(userId, payload)
        if (isUsableSavedBlock(savedBlock)) {
          handlersRef.current.onAdministrativeSaved?.(savedBlock)
        }
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
        const savedBlock = await updatePedagogicalProfile(userId, payload)
        if (isUsableSavedBlock(savedBlock)) {
          handlersRef.current.onPedagogicalSaved?.(savedBlock)
        }
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
        const savedBlock = await updatePrescription(userId, payload)
        if (isUsableSavedBlock(savedBlock)) {
          handlersRef.current.onPrescriptionSaved?.(savedBlock)
        }
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
