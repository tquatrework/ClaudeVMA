import { useCallback, useMemo, useState } from 'react'
import {
  addWeeksUtc,
  getDisplayWeek,
  getMondayOfWeek,
  type CalendarDisplayWeek,
} from '../../utils/calendarDisplayWeek'

export interface UseCalendarWeekNavigationResult {
  displayWeek: CalendarDisplayWeek
  isCurrentWeek: boolean
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToToday: () => void
}

/**
 * useCalendarWeekNavigation — état de la semaine calendaire affichée par `CalendarUnifiedView`
 * (correction du 2026-08-20, point B). La semaine en cours au montage, navigable semaine par
 * semaine — nécessaire pour créer un événement au-delà de la semaine affichée par défaut.
 *
 * Purement client : les données (disponibilités, activités, événements) sont déjà chargées dans
 * leur intégralité par la page (règle du 2026-08-10) — naviguer d'une semaine à l'autre ne
 * déclenche donc aucun nouvel appel réseau, seulement un filtrage local par semaine affichée.
 */
export function useCalendarWeekNavigation(
  referenceDate: Date = new Date(),
): UseCalendarWeekNavigationResult {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(referenceDate))

  const displayWeek = useMemo(() => getDisplayWeek(weekStart), [weekStart])

  const goToPreviousWeek = useCallback(() => {
    setWeekStart((previous) => addWeeksUtc(previous, -1))
  }, [])

  const goToNextWeek = useCallback(() => {
    setWeekStart((previous) => addWeeksUtc(previous, 1))
  }, [])

  const goToToday = useCallback(() => {
    setWeekStart(getMondayOfWeek(new Date()))
  }, [])

  const isCurrentWeek = weekStart.getTime() === getMondayOfWeek(new Date()).getTime()

  return { displayWeek, isCurrentWeek, goToPreviousWeek, goToNextWeek, goToToday }
}
