import { fetchUserEvents } from '../../api/calendar'
import type { CalendarEvent } from '../../types/calendar'
import { useAsyncData } from '../useAsyncData'
import { getFutureEvents } from '../../utils/dashboardFormat'

export interface UseUpcomingCoursesResult {
  nextCourse: CalendarEvent | null
  upcomingCourses: CalendarEvent[]
  isLoadingCourses: boolean
  coursesError: string | null
}

/**
 * useUpcomingCourses — charge GET /calendars/:userId/events et dérive le prochain cours plus
 * une courte liste de cours suivants. Factorise la logique identique dupliquée entre
 * EleveDashboardPage (3 cours suivants) et ProfesseurDashboardPage (4 cours suivants).
 *
 * Comportement préexistant préservé : aucun message d'erreur n'était affiché en cas d'échec
 * (dégradation silencieuse vers "aucun cours") — `coursesError` est exposé mais non rendu
 * par ces pages, à l'identique.
 */
export function useUpcomingCourses(
  userId: string | undefined,
  maxUpcoming: number,
): UseUpcomingCoursesResult {
  const { data, isLoading, error } = useAsyncData(
    () => (userId ? fetchUserEvents(userId) : Promise.resolve([])),
    [userId],
    { fallbackErrorMessage: 'Impossible de charger le calendrier' },
  )

  const futureEvents = getFutureEvents(data ?? [])

  return {
    nextCourse: futureEvents[0] ?? null,
    upcomingCourses: futureEvents.slice(1, 1 + maxUpcoming),
    isLoadingCourses: isLoading,
    coursesError: error,
  }
}
