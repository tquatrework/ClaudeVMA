/**
 * calendarUnifiedGridSlot.ts — types et fonctions pures partagées par `CalendarUnifiedView` pour
 * discriminer les trois sources fusionnées sur la grille (chantier calendrier vue unifiée, point
 * 1) et construire les valeurs initiales du formulaire de disponibilité. Extrait pour garder
 * `CalendarUnifiedView.tsx` sous la limite de taille de fichier (convention `src/CLAUDE.md`).
 */

import type { AvailabilitySlot } from '../types/calendar'
import type { ScheduledActivityGridBlock } from './scheduledActivityGridBlocks'
import type { CalendarEventGridBlock } from './calendarEventGridBlocks'
import type { AvailabilitySlotFormInitialValues } from '../components/calendar/AvailabilitySlotFormModal'

/** Slot affichable par la grille unifiée — créneau de disponibilité éditable, activité planifiée
 * (proposition/confirmation de cours) ou événement de calendrier, ces deux derniers en lecture
 * seule (voir `renderBlockOverlay` dans `CalendarUnifiedView`). */
export type CalendarGridSlot = AvailabilitySlot | ScheduledActivityGridBlock | CalendarEventGridBlock

export function isAvailabilitySlotBlock(slot: CalendarGridSlot): slot is AvailabilitySlot {
  return slot.kind === 'AVAILABLE' || slot.kind === 'UNAVAILABLE'
}

export function isCalendarEventBlock(slot: CalendarGridSlot): slot is CalendarEventGridBlock {
  return slot.kind === 'EVENT' || slot.kind === 'EVENT_PENDING'
}

/**
 * `startTime`/`endTime` en création proviennent désormais toujours de la sélection réelle faite
 * sur la grille (correction du 2026-08-20, point C — clic ou glisser, au quart d'heure près),
 * jamais recalculées ici : `AvailabilityGrid` fournit toujours les deux bornes.
 */
export type AvailabilityFormTarget =
  | { mode: 'create'; dayOfWeek: number; startTime: string; endTime: string }
  | { mode: 'edit'; slot: AvailabilitySlot }

export function buildAvailabilityFormInitialValues(
  target: AvailabilityFormTarget,
): AvailabilitySlotFormInitialValues {
  if (target.mode === 'edit') {
    return {
      dayOfWeek: target.slot.dayOfWeek,
      startTime: target.slot.startTime,
      endTime: target.slot.endTime,
      kind: target.slot.kind,
      recurrence: target.slot.recurrence,
      recurrenceEndDate: target.slot.recurrenceEndDate,
    }
  }
  return {
    dayOfWeek: target.dayOfWeek,
    startTime: target.startTime,
    endTime: target.endTime,
    kind: 'AVAILABLE',
    recurrence: 'NONE',
    recurrenceEndDate: null,
  }
}
