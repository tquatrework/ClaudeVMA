import { fetchAvailability } from '../../api/calendar'
import type { AvailabilitySlot } from '../../types/calendar'
import { useAsyncData, type UseAsyncDataResult } from '../useAsyncData'

/**
 * AvailabilityEditor n'affichait qu'un message d'erreur générique unique, quel que soit le
 * statut HTTP (jamais le mapping par défaut de `getErrorMessage`) — on enveloppe l'erreur ici
 * pour préserver ce comportement exact.
 */
async function loadAvailability(ownerId: string): Promise<AvailabilitySlot[]> {
  try {
    return await fetchAvailability(ownerId)
  } catch {
    throw {
      response: { data: { message: 'Impossible de charger les disponibilités' } },
    }
  }
}

/**
 * useAvailabilitySlots — charge les créneaux de disponibilité d'un calendrier pour
 * AvailabilityEditor.
 */
export function useAvailabilitySlots(ownerId: string): UseAsyncDataResult<AvailabilitySlot[]> {
  return useAsyncData(() => loadAvailability(ownerId), [ownerId], {
    fallbackErrorMessage: 'Impossible de charger les disponibilités',
  })
}
