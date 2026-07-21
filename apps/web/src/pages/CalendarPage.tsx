import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import {
  CalendarEvent,
  EventType,
  InviteeStatus,
  EVENT_TYPE_LABELS,
  ALLOWED_EVENT_TYPES_BY_ROLE,
} from '../components/calendar/calendarTypes'
import EventCreateDialog from '../components/calendar/EventCreateDialog'
import InvitationBanner from '../components/calendar/InvitationBanner'
import CancellationRequestDialog from '../components/calendar/CancellationRequestDialog'
import { useCalendarEvents } from '../hooks/calendar/useCalendarEvents'
import { EventCard } from '../components/calendar/EventCard'

type ViewMode = 'upcoming' | 'past'

export default function CalendarPage() {
  const { user, hasRole } = useAuth()

  const [activeViewMode, setActiveViewMode] = useState<ViewMode>('upcoming')
  const [filterEventType, setFilterEventType] = useState<EventType | ''>('')
  const [filterPersonId, setFilterPersonId] = useState('')

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [cancellationTarget, setCancellationTarget] = useState<CalendarEvent | null>(null)
  const [expandedReminderEventId, setExpandedReminderEventId] = useState<string | null>(null)

  const {
    events,
    invitations,
    isLoading,
    errorMessage,
    dismissError,
    addEvent,
    updateInvitationStatus,
    markEventCancelled,
  } = useCalendarEvents(user?.id, filterEventType, filterPersonId)

  const canCreateEvent =
    user !== null && (ALLOWED_EVENT_TYPES_BY_ROLE[user.role] ?? []).length > 0

  const handleEventCreated = (newEvent: CalendarEvent) => {
    addEvent(newEvent)
    setIsCreateDialogOpen(false)
  }

  const handleInvitationStatusChange = (eventId: string, newStatus: InviteeStatus) => {
    updateInvitationStatus(eventId, newStatus)
  }

  const handleCancellationDone = () => {
    if (cancellationTarget) {
      markEventCancelled(cancellationTarget.id)
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
              onClick={dismissError}
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
