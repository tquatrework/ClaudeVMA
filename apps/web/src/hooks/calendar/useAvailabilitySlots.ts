import { useCallback, useState } from 'react'
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchAvailability,
  updateAvailabilitySlot,
} from '../../api/calendar'
import type {
  AvailabilitySlot,
  CreateAvailabilitySlotPayload,
  UpdateAvailabilitySlotPayload,
} from '../../types/calendar'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'

export interface UseAvailabilitySlotsResult {
  slots: AvailabilitySlot[]
  isLoading: boolean
  loadError: string | null

  createSlot: (payload: CreateAvailabilitySlotPayload) => Promise<boolean>
  updateSlot: (slotId: string, payload: UpdateAvailabilitySlotPayload) => Promise<boolean>
  deleteSlot: (slotId: string) => Promise<boolean>
  isSaving: boolean

  actionError: string | null
  clearActionError: () => void
}

/**
 * useAvailabilitySlots — hook d'orchestration par page pour l'onglet "Mes disponibilités".
 *
 * Après chaque écriture, la liste locale est mise à jour avec la **réponse réelle du serveur**
 * (jamais le corps envoyé, jamais avant confirmation) — pas d'état optimiste. Pattern repris de
 * `useTeacherRequestDetail` (arbitrage du 2026-08-10 sur le chargement des données).
 */
export function useAvailabilitySlots(ownerId: string | undefined): UseAvailabilitySlotsResult {
  const { data, isLoading, error: loadError } = useAsyncData(
    () => (ownerId ? fetchAvailability(ownerId) : Promise.resolve([])),
    [ownerId],
    { fallbackErrorMessage: 'Impossible de charger les disponibilités.' },
  )

  const [slotsOverride, setSlotsOverride] = useState<AvailabilitySlot[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const currentSlots = slotsOverride ?? data ?? []

  const createSlot = useCallback(
    async (payload: CreateAvailabilitySlotPayload): Promise<boolean> => {
      if (!ownerId) return false
      setIsSaving(true)
      setActionError(null)
      try {
        const createdSlot = await createAvailabilitySlot(ownerId, payload)
        setSlotsOverride((previous) => [...(previous ?? data ?? []), createdSlot])
        return true
      } catch (caughtError) {
        setActionError(getErrorMessage(caughtError, "Le créneau n'a pas pu être créé."))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [ownerId, data],
  )

  const updateSlot = useCallback(
    async (slotId: string, payload: UpdateAvailabilitySlotPayload): Promise<boolean> => {
      if (!ownerId) return false
      setIsSaving(true)
      setActionError(null)
      try {
        const existingSlot = (slotsOverride ?? data ?? []).find((slot) => slot.id === slotId)
        const updatedSlot = await updateAvailabilitySlot(
          ownerId,
          slotId,
          payload,
          existingSlot?.dayOfWeek,
        )
        setSlotsOverride((previous) =>
          (previous ?? data ?? []).map((slot) => (slot.id === slotId ? updatedSlot : slot)),
        )
        return true
      } catch (caughtError) {
        setActionError(getErrorMessage(caughtError, "Le créneau n'a pas pu être modifié."))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [ownerId, data],
  )

  const deleteSlot = useCallback(
    async (slotId: string): Promise<boolean> => {
      if (!ownerId) return false
      setIsSaving(true)
      setActionError(null)
      try {
        await deleteAvailabilitySlot(ownerId, slotId)
        setSlotsOverride((previous) =>
          (previous ?? data ?? []).filter((slot) => slot.id !== slotId),
        )
        return true
      } catch (caughtError) {
        setActionError(getErrorMessage(caughtError, "Le créneau n'a pas pu être supprimé."))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [ownerId, data],
  )

  return {
    slots: currentSlots,
    isLoading,
    loadError,
    createSlot,
    updateSlot,
    deleteSlot,
    isSaving,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
  }
}
