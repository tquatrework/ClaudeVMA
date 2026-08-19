import React, { useMemo, useState } from 'react'
import {
  CalendarEvent,
  EventType,
  EVENT_TYPE_LABELS,
  ALLOWED_EVENT_TYPES_BY_ROLE,
} from './calendarTypes'
import { useEventCreate } from '../../hooks/calendar/useEventCreate'
import { buildIsoDateTimeForDay } from '../../utils/availabilitySlotApiMapping'
import { addOneHourToTime } from '../../utils/availabilityTime'
import { getDayLabel } from '../../utils/availabilityDays'

interface QuickEventCreatePopoverProps {
  ownerId: string
  userRole: string
  /** Case cliquée sur la grille — jour de semaine + heure, jamais une date saisie à la main. */
  dayOfWeek: number
  startTime: string
  onCreated: (event: CalendarEvent) => void
  onClose: () => void
}

/**
 * QuickEventCreatePopover — mini-formulaire de création d'événement déclenché par un clic direct
 * sur une case vide de la grille unifiée, en mode « Créer un événement » (chantier calendrier vue
 * unifiée, point 3). Remplace `EventCreateDialog` (supprimé) et son couple de champs
 * `datetime-local` saisis à la main — source du bug rapporté par l'utilisateur
 * ("startTime must be a valid ISO 8601…") : la date ne provient plus jamais d'une saisie libre,
 * uniquement du jour/heure cliqués sur la grille.
 *
 * La grille est un gabarit hebdomadaire récurrent (point 1, sans année ni semaine affichée) : la
 * date réelle retenue est donc la **prochaine occurrence** de ce jour de semaine (aujourd'hui
 * inclus), calculée par `buildIsoDateTimeForDay` — déjà utilisée pour les créneaux de
 * disponibilité. Elle est affichée en toutes lettres avant validation, pour que l'utilisateur
 * confirme la date réelle retenue plutôt que de la deviner.
 */
export default function QuickEventCreatePopover({
  ownerId,
  userRole,
  dayOfWeek,
  startTime,
  onCreated,
  onClose,
}: QuickEventCreatePopoverProps) {
  const allowedTypes: EventType[] = ALLOWED_EVENT_TYPES_BY_ROLE[userRole] ?? []

  const [title, setTitle] = useState('')
  const [selectedEventType, setSelectedEventType] = useState<EventType>(allowedTypes[0] ?? 'rappel')

  const { isSaving, errorMessage, submit } = useEventCreate(ownerId)

  const endTime = useMemo(() => addOneHourToTime(startTime), [startTime])

  const startAt = useMemo(
    () => buildIsoDateTimeForDay(dayOfWeek, startTime),
    [dayOfWeek, startTime],
  )
  const endAt = useMemo(() => buildIsoDateTimeForDay(dayOfWeek, endTime), [dayOfWeek, endTime])

  const resolvedDateLabel = useMemo(() => {
    const parsed = new Date(startAt)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }, [startAt])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const payload: { startAt: string; endAt: string; eventType: EventType; title?: string } = {
      startAt,
      endAt,
      eventType: selectedEventType,
    }
    if (title.trim()) payload.title = title.trim()

    const created = await submit(payload)
    if (created) onCreated(created)
  }

  if (allowedTypes.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        role="dialog"
        aria-modal="true"
        aria-label="Créer un événement"
      >
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
          <p className="text-sm text-gray-600 mb-4">
            Votre rôle ne permet pas de créer d'événement de calendrier.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Créer un événement"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Nouvel événement</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {getDayLabel(dayOfWeek)} {resolvedDateLabel}, {startTime} – {endTime}
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="quick-event-title" className="block text-sm font-medium text-gray-700 mb-1">
              Titre (optionnel)
            </label>
            <input
              id="quick-event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Cours de mathématiques"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label htmlFor="quick-event-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="quick-event-type"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as EventType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {allowedTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {EVENT_TYPE_LABELS[eventType]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Création…' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
