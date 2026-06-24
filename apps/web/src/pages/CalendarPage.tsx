import React, { useEffect, useState } from 'react'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import {
  CalendarEvent,
  EventType,
  InviteeStatus,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  ALLOWED_EVENT_TYPES_BY_ROLE,
} from '../components/calendar/calendarTypes'
import EventCreateDialog from '../components/calendar/EventCreateDialog'
import InvitationBanner from '../components/calendar/InvitationBanner'
import CancellationRequestDialog from '../components/calendar/CancellationRequestDialog'
import ReminderSettingsPanel from '../components/calendar/ReminderSettingsPanel'

interface InvitationEntry {
  event: CalendarEvent
  status: InviteeStatus
}

type ViewMode = 'upcoming' | 'past'

export default function CalendarPage() {
  const { user, hasRole } = useAuth()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [activeViewMode, setActiveViewMode] = useState<ViewMode>('upcoming')
  const [filterEventType, setFilterEventType] = useState<EventType | ''>('')
  const [filterPersonId, setFilterPersonId] = useState('')

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [cancellationTarget, setCancellationTarget] = useState<CalendarEvent | null>(null)
  const [expandedReminderEventId, setExpandedReminderEventId] = useState<string | null>(null)

  const [invitations, setInvitations] = useState<InvitationEntry[]>([])

  const canCreateEvent =
    user !== null && (ALLOWED_EVENT_TYPES_BY_ROLE[user.role] ?? []).length > 0

  useEffect(() => {
    if (!user) return

    const queryParams = new URLSearchParams()
    if (filterEventType) queryParams.set('type', filterEventType)
    if (filterPersonId.trim()) queryParams.set('personId', filterPersonId.trim())

    const queryString = queryParams.toString()
    const endpoint = `/calendars/${user.id}/events${queryString ? `?${queryString}` : ''}`

    setIsLoading(true)
    apiClient
      .get<CalendarEvent[]>(endpoint)
      .then(({ data }) => {
        const fetchedEvents = Array.isArray(data) ? data : []
        setEvents(fetchedEvents)

        const pendingInvitations: InvitationEntry[] = fetchedEvents
          .filter((event) => event.eventType === 'invitation' || event.inviteeStatus !== undefined)
          .map((event) => ({
            event,
            status: event.inviteeStatus ?? 'pending',
          }))
        setInvitations(pendingInvitations)
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé')
        else setErrorMessage('Impossible de charger le calendrier')
      })
      .finally(() => setIsLoading(false))
  }, [user, filterEventType, filterPersonId])

  const handleEventCreated = (newEvent: CalendarEvent) => {
    setEvents((prev) => [newEvent, ...prev])
    setIsCreateDialogOpen(false)
  }

  const handleInvitationStatusChange = (eventId: string, newStatus: InviteeStatus) => {
    setInvitations((prev) =>
      prev
        .map((inv) => (inv.event.id === eventId ? { ...inv, status: newStatus } : inv))
        .filter((inv) => inv.status !== 'declined'),
    )
  }

  const handleCancellationDone = () => {
    if (cancellationTarget) {
      setEvents((prev) =>
        prev.map((event) =>
          event.id === cancellationTarget.id ? { ...event, status: 'cancelled' } : event,
        ),
      )
    }
    setCancellationTarget(null)
  }

  const now = new Date()

  const pendingInvitationIds = new Set(
    invitations.filter((inv) => inv.status === 'pending').map((inv) => inv.event.id),
  )

  const sortedEvents = [...events]
    .filter((event) => !pendingInvitationIds.has(event.id))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  const upcomingEvents = sortedEvents.filter((event) => new Date(event.startAt) >= now)
  const pastEvents = [...sortedEvents]
    .reverse()
    .filter((event) => new Date(event.startAt) < now)

  const displayedEvents = activeViewMode === 'upcoming' ? upcomingEvents : pastEvents
  const isPastView = activeViewMode === 'past'

  const allEventTypes: EventType[] = [
    'cours', 'masterclass', 'pedagogique', 'financier', 'rappel', 'invitation',
  ]

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mon calendrier</h1>
            <p className="text-sm text-gray-500 mt-1">
              {events.length} événement{events.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreateEvent && (
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              Nouvel événement
            </button>
          )}
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Invitations en attente */}
        {user && invitations.length > 0 && (
          <InvitationBanner
            invitations={invitations}
            userId={user.id}
            onStatusChange={handleInvitationStatusChange}
          />
        )}

        {/* Filtres */}
        <div className="mb-5 flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type d'événement</label>
            <select
              value={filterEventType}
              onChange={(e) => setFilterEventType(e.target.value as EventType | '')}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label="Filtrer par type d'événement"
            >
              <option value="">Tous les types</option>
              {allEventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {EVENT_TYPE_LABELS[eventType]}
                </option>
              ))}
            </select>
          </div>

          {hasRole('responsable_pedagogique', 'animateur_pedagogique', 'formateur', 'technicien_informatique') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Personne (ID)</label>
              <input
                type="text"
                value={filterPersonId}
                onChange={(e) => setFilterPersonId(e.target.value)}
                placeholder="UUID de la personne"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Filtrer par personne"
              />
            </div>
          )}
        </div>

        {/* Bascule à venir / passés */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-5 w-fit">
          <button
            onClick={() => setActiveViewMode('upcoming')}
            className={`px-4 py-2 text-sm ${
              activeViewMode === 'upcoming'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            À venir ({upcomingEvents.length})
          </button>
          <button
            onClick={() => setActiveViewMode('past')}
            className={`px-4 py-2 text-sm border-l border-gray-200 ${
              activeViewMode === 'past'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Passés ({pastEvents.length})
          </button>
        </div>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && events.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucune activité planifiée</p>
            {canCreateEvent && (
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="mt-3 text-indigo-600 hover:underline text-sm"
              >
                Créer le premier événement
              </button>
            )}
          </div>
        )}

        {!isLoading && events.length > 0 && displayedEvents.length === 0 && (
          <div className="text-center py-8 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">
              {isPastView ? 'Aucun événement passé' : 'Aucun événement à venir'}
            </p>
          </div>
        )}

        {displayedEvents.length > 0 && (
          <ul className="space-y-3">
            {displayedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isPast={isPastView}
                onRequestCancellation={() => setCancellationTarget(event)}
                isReminderExpanded={expandedReminderEventId === event.id}
                onToggleReminder={() =>
                  setExpandedReminderEventId((prev) =>
                    prev === event.id ? null : event.id,
                  )
                }
              />
            ))}
          </ul>
        )}
      </div>

      {isCreateDialogOpen && user && (
        <EventCreateDialog
          ownerId={user.id}
          userRole={user.role}
          onCreated={handleEventCreated}
          onClose={() => setIsCreateDialogOpen(false)}
        />
      )}

      {cancellationTarget && (
        <CancellationRequestDialog
          eventId={cancellationTarget.id}
          eventTitle={cancellationTarget.title}
          onCancelled={handleCancellationDone}
          onClose={() => setCancellationTarget(null)}
        />
      )}
    </Layout>
  )
}

interface EventCardProps {
  event: CalendarEvent
  isPast: boolean
  onRequestCancellation: () => void
  isReminderExpanded: boolean
  onToggleReminder: () => void
}

function EventCard({
  event,
  isPast,
  onRequestCancellation,
  isReminderExpanded,
  onToggleReminder,
}: EventCardProps) {
  const typeColorClass = EVENT_TYPE_COLORS[event.eventType] ?? 'bg-gray-100 text-gray-600'
  const isCancelled = event.status === 'cancelled'
  const isAccepted = event.inviteeStatus === 'accepted'

  return (
    <li
      className={`p-4 border rounded-xl transition-all ${
        isPast
          ? 'bg-gray-50 border-gray-100'
          : isCancelled
            ? 'bg-red-50 border-red-100'
            : isAccepted
              ? 'bg-green-50 border-green-200'
              : 'bg-white border-gray-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`font-medium text-sm ${isPast ? 'text-gray-500' : 'text-gray-800'}`}>
            {event.title ?? `Événement #${event.id.slice(0, 8)}`}
          </span>
          <p className={`text-xs mt-1 ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>
            {new Date(event.startAt).toLocaleString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' → '}
            {new Date(event.endAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {event.description && (
            <p className="text-xs text-gray-400 mt-1 truncate">{event.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColorClass}`}>
            {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
          </span>
          {isCancelled && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              Annulé
            </span>
          )}
          {isAccepted && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Accepté
            </span>
          )}
        </div>
      </div>

      {!isPast && !isCancelled && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <button
            onClick={onRequestCancellation}
            className="text-xs text-red-600 hover:underline"
          >
            Demander l'annulation
          </button>
          <button
            onClick={onToggleReminder}
            className="text-xs text-indigo-600 hover:underline"
          >
            {isReminderExpanded ? 'Masquer les rappels' : 'Configurer un rappel'}
          </button>
        </div>
      )}

      {isReminderExpanded && !isPast && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <ReminderSettingsPanel eventId={event.id} />
        </div>
      )}
    </li>
  )
}
