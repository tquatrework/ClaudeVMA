import { useCallback, useEffect, useState } from 'react'
import { fetchOwnerEvents } from '../../api/calendar'
import type { FetchOwnerEventsParams } from '../../api/calendar'
import type {
  CalendarEvent,
  EventType,
  InviteeStatus,
} from '../../components/calendar/calendarTypes'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

export interface InvitationEntry {
  event: CalendarEvent
  status: InviteeStatus
}

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  invitations: InvitationEntry[]
  isLoading: boolean
  errorMessage: string | null
  dismissError: () => void
  addEvent: (event: CalendarEvent) => void
  updateInvitationStatus: (eventId: string, newStatus: InviteeStatus) => void
  markEventCancelled: (eventId: string) => void
}

/**
 * CalendarPage n'affichait jamais "Accès refusé" que sur un 403, et toujours le même
 * message générique sur tout autre statut (jamais le mapping par défaut de
 * `getErrorMessage`) — on enveloppe l'erreur ici pour préserver ce comportement exact.
 */
async function loadOwnerEvents(
  ownerId: string,
  params: FetchOwnerEventsParams,
): Promise<CalendarEvent[]> {
  try {
    return await fetchOwnerEvents(ownerId, params)
  } catch (caughtError: unknown) {
    const status = getErrorStatus(caughtError)
    throw {
      response: {
        data: { message: status === 403 ? 'Accès refusé' : 'Impossible de charger le calendrier' },
      },
    }
  }
}

/**
 * useCalendarEvents — orchestration de CalendarPage : chargement des événements d'un
 * calendrier (avec filtres type/personId), dérivation des invitations en attente, et
 * mises à jour locales optimistes (création d'événement, changement de statut d'invitation,
 * annulation) sans recharger la liste complète depuis le serveur — reproduit le
 * comportement préexistant de la page.
 */
export function useCalendarEvents(
  ownerId: string | undefined,
  filterEventType: EventType | '',
  filterPersonId: string,
): UseCalendarEventsResult {
  const trimmedPersonId = filterPersonId.trim()

  const { data, isLoading, error } = useAsyncData(
    () =>
      ownerId
        ? loadOwnerEvents(ownerId, {
            type: filterEventType || undefined,
            personId: trimmedPersonId || undefined,
          })
        : Promise.resolve([]),
    [ownerId, filterEventType, trimmedPersonId],
    { fallbackErrorMessage: 'Impossible de charger le calendrier' },
  )

  const [eventsOverride, setEventsOverride] = useState<CalendarEvent[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationEntry[]>([])
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)

  useEffect(() => {
    setEventsOverride(null)
  }, [data])

  useEffect(() => {
    if (!data) {
      setInvitations([])
      return
    }
    const pendingInvitations: InvitationEntry[] = data
      .filter((event) => event.eventType === 'invitation' || event.inviteeStatus !== undefined)
      .map((event) => ({ event, status: event.inviteeStatus ?? 'pending' }))
    setInvitations(pendingInvitations)
  }, [data])

  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  const events = eventsOverride ?? data ?? []

  const addEvent = useCallback(
    (event: CalendarEvent) => {
      setEventsOverride((previous) => [event, ...(previous ?? data ?? [])])
    },
    [data],
  )

  const updateInvitationStatus = useCallback((eventId: string, newStatus: InviteeStatus) => {
    setInvitations((previous) =>
      previous
        .map((invitation) =>
          invitation.event.id === eventId ? { ...invitation, status: newStatus } : invitation,
        )
        .filter((invitation) => invitation.status !== 'declined'),
    )
  }, [])

  const markEventCancelled = useCallback(
    (eventId: string) => {
      setEventsOverride((previous) =>
        (previous ?? data ?? []).map((event) =>
          event.id === eventId ? { ...event, status: 'cancelled' } : event,
        ),
      )
    },
    [data],
  )

  return {
    events,
    invitations,
    isLoading,
    errorMessage: isErrorDismissed ? null : error,
    dismissError: () => setIsErrorDismissed(true),
    addEvent,
    updateInvitationStatus,
    markEventCancelled,
  }
}
