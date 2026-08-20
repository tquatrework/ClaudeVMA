/**
 * EventCard — carte d'un événement de calendrier (à venir ou passé), avec
 * actions d'annulation et de configuration de rappel.
 * Extrait de CalendarPage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import { CalendarEvent, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from './calendarTypes'
import ReminderSettingsPanel from './ReminderSettingsPanel'

interface EventCardProps {
  event: CalendarEvent
  isPast: boolean
  onRequestCancellation: () => void
  isReminderExpanded: boolean
  onToggleReminder: () => void
}

export function EventCard({
  event,
  isPast,
  onRequestCancellation,
  isReminderExpanded,
  onToggleReminder,
}: EventCardProps) {
  const typeColorClass = EVENT_TYPE_COLORS[event.eventType] ?? 'bg-gray-100 text-gray-600'
  const isCancelled = event.status === 'cancelled'
  const isAccepted = event.viewerInvitationStatus === 'accepted'

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
            {event.title || 'Sans titre'}
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
