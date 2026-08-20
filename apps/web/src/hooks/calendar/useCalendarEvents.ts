import { useCallback, useEffect, useState } from 'react'
import {
  fetchOwnerEvents,
  acceptEventInvitation,
  declineEventInvitation,
  deleteOwnerEvent,
} from '../../api/calendar'
import type { FetchOwnerEventsParams } from '../../api/calendar'
import type { CalendarEvent, EventType } from '../../components/calendar/calendarTypes'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  isLoading: boolean
  errorMessage: string | null
  dismissError: () => void
  addEvent: (event: CalendarEvent) => void
  markEventCancelled: (eventId: string) => void

  /** `eventId` de l'invitation en cours de traitement (accept/decline), ou `null`. */
  respondingEventId: string | null
  respondError: string | null
  clearRespondError: () => void
  /**
   * Répond à une invitation d'événement (`event.viewerInvitationStatus === "pending"`).
   * `POST /events/:id/invitees/:userId/accept|decline` ne documentent aucun corps de réponse
   * exploitable (`docs/routes.md`) : plutôt que de deviner un état local optimiste, on relit la
   * liste réelle depuis le serveur après succès (`refetch`) — même principe que
   * `useOwnerCalendarActivities`, en s'appuyant ici sur une route déjà documentée
   * (`GET /calendars/:ownerId/events`) plutôt que sur un contrat de réponse non écrit. Renvoie
   * `true` en cas de succès, pour que l'appelant ferme la modale de détail.
   */
  respondToEventInvitation: (eventId: string, action: 'accept' | 'decline') => Promise<boolean>

  /** `eventId` de l'événement en cours de suppression, ou `null`. */
  deletingEventId: string | null
  deleteError: string | null
  clearDeleteError: () => void
  /**
   * `DELETE /calendars/:ownerId/events/:eventId` — créateur, RP ou TI (`docs/routes.md`, route
   * ajoutée le 2026-08-20). Retire l'événement de la liste locale en cas de succès (`204` sans
   * corps : rien à réafficher depuis la réponse). Renvoie `true` en cas de succès.
   */
  deleteEvent: (eventId: string) => Promise<boolean>
}

const RESPOND_FALLBACK_MESSAGE = "Votre réponse n'a pas pu être enregistrée."
const DELETE_FALLBACK_MESSAGE = "Impossible de supprimer cet événement."
const DELETE_FORBIDDEN_MESSAGE = "Vous n'avez pas le droit de supprimer cet événement."

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
 * useCalendarEvents — orchestration de CalendarUnifiedView : chargement des événements d'un
 * calendrier (avec filtres type/personId), mises à jour locales optimistes pour la création et
 * l'annulation (déjà reflétées par la réponse serveur au moment de l'appel), et gestion des
 * réponses à une invitation / de la suppression d'un événement (chantier "invitation
 * d'événement invisible pour l'invité", 2026-08-20) — voir `respondToEventInvitation` et
 * `deleteEvent` pour le détail de ce que chacune fait après succès.
 */
export function useCalendarEvents(
  ownerId: string | undefined,
  filterEventType: EventType | '',
  filterPersonId: string,
): UseCalendarEventsResult {
  const trimmedPersonId = filterPersonId.trim()

  const { data, isLoading, error, refetch } = useAsyncData(
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
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  const [respondingEventId, setRespondingEventId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setEventsOverride(null)
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

  const respondToEventInvitation = useCallback(
    async (eventId: string, action: 'accept' | 'decline'): Promise<boolean> => {
      if (!ownerId) return false
      setRespondingEventId(eventId)
      setRespondError(null)
      try {
        if (action === 'accept') {
          await acceptEventInvitation(eventId, ownerId)
        } else {
          await declineEventInvitation(eventId, ownerId)
        }
        refetch()
        return true
      } catch (caughtError: unknown) {
        setRespondError(getErrorMessage(caughtError, RESPOND_FALLBACK_MESSAGE))
        return false
      } finally {
        setRespondingEventId(null)
      }
    },
    [ownerId, refetch],
  )

  const deleteEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      if (!ownerId) return false
      setDeletingEventId(eventId)
      setDeleteError(null)
      try {
        await deleteOwnerEvent(ownerId, eventId)
        setEventsOverride((previous) => (previous ?? data ?? []).filter((event) => event.id !== eventId))
        return true
      } catch (caughtError: unknown) {
        const status = getErrorStatus(caughtError)
        setDeleteError(
          status === 403 ? DELETE_FORBIDDEN_MESSAGE : getErrorMessage(caughtError, DELETE_FALLBACK_MESSAGE),
        )
        return false
      } finally {
        setDeletingEventId(null)
      }
    },
    [ownerId, data],
  )

  return {
    events,
    isLoading,
    errorMessage: isErrorDismissed ? null : error,
    dismissError: () => setIsErrorDismissed(true),
    addEvent,
    markEventCancelled,
    respondingEventId,
    respondError,
    clearRespondError: useCallback(() => setRespondError(null), []),
    respondToEventInvitation,
    deletingEventId,
    deleteError,
    clearDeleteError: useCallback(() => setDeleteError(null), []),
    deleteEvent,
  }
}
