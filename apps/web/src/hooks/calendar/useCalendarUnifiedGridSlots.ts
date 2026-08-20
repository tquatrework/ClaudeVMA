import { useMemo } from 'react'
import type { AvailabilitySlot, CalendarActivityEntry } from '../../types/calendar'
import type { CalendarEvent } from '../../components/calendar/calendarTypes'
import type { CalendarDisplayWeek } from '../../utils/calendarDisplayWeek'
import { isRecurrenceStillActiveOnDate } from '../../utils/calendarDisplayWeek'
import {
  toScheduledActivityGridBlocks,
  type ScheduledActivityGridBlock,
} from '../../utils/scheduledActivityGridBlocks'
import {
  toCalendarEventGridBlocks,
  type CalendarEventGridBlock,
} from '../../utils/calendarEventGridBlocks'
import type { CalendarGridSlot } from '../../utils/calendarUnifiedGridSlot'

export interface UseCalendarUnifiedGridSlotsResult {
  gridSlots: CalendarGridSlot[]
  activityBlocks: ScheduledActivityGridBlock[]
  eventBlocks: CalendarEventGridBlock[]
  visibleSlots: AvailabilitySlot[]
}

/**
 * useCalendarUnifiedGridSlots — assemble les trois sources de la grille unifiée pour la semaine
 * calendaire affichée (correction du 2026-08-20, point B). Extrait de `CalendarUnifiedView` pour
 * rester sous la limite de taille de fichier (convention `src/CLAUDE.md`).
 *
 * Les créneaux de disponibilité (récurrents par `dayOfWeek`) sont projetés sur chaque semaine
 * affichée, sous réserve d'une `recurrenceEndDate` dépassée pour ce jour réel. Les activités et
 * événements (dates réelles) sont filtrés à la semaine affichée par leurs fonctions dédiées.
 */
export function useCalendarUnifiedGridSlots(
  slots: AvailabilitySlot[],
  activities: CalendarActivityEntry[],
  events: CalendarEvent[],
  displayWeek: CalendarDisplayWeek,
): UseCalendarUnifiedGridSlotsResult {
  const visibleSlots = useMemo(
    () =>
      slots.filter((slot) => {
        const dayDate = displayWeek.days.find((day) => day.dayOfWeek === slot.dayOfWeek)?.date
        return isRecurrenceStillActiveOnDate(
          slot.recurrence,
          slot.recurrenceEndDate,
          dayDate ?? displayWeek.weekStart,
        )
      }),
    [slots, displayWeek],
  )

  const activityBlocks = useMemo(
    () => toScheduledActivityGridBlocks(activities, displayWeek.weekStart),
    [activities, displayWeek],
  )

  const eventBlocks = useMemo(
    () => toCalendarEventGridBlocks(events, displayWeek.weekStart),
    [events, displayWeek],
  )

  const gridSlots = useMemo<CalendarGridSlot[]>(
    () => [...visibleSlots, ...activityBlocks, ...eventBlocks],
    [visibleSlots, activityBlocks, eventBlocks],
  )

  return { gridSlots, activityBlocks, eventBlocks, visibleSlots }
}
