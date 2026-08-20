import React, { useMemo, useState } from 'react'
import {
  CalendarEvent,
  EventType,
  EVENT_TYPE_LABELS,
  ALLOWED_EVENT_TYPES_BY_ROLE,
} from './calendarTypes'
import { useEventCreate } from '../../hooks/calendar/useEventCreate'
import { toDateTimeLocalValue, fromDateTimeLocalValue } from '../../utils/calendarDateTimeLocal'
import EventRecipientPicker from './EventRecipientPicker'

interface EventCreateFormModalProps {
  ownerId: string
  userRole: string
  /** Début/fin par défaut, ISO UTC — déduits de la sélection faite sur la grille (point C),
   * ajustables ensuite dans ce formulaire. */
  defaultStartAt: string
  defaultEndAt: string
  /** Bornes ISO de la semaine affichée — transmises à `EventRecipientPicker` pour la
   * prévisualisation busy/free du destinataire en cours de sélection. */
  weekFrom: string
  weekTo: string
  onCreated: (event: CalendarEvent) => void
  onClose: () => void
}

/**
 * EventCreateFormModal — remplace `QuickEventCreatePopover` (correction du 2026-08-20, point D) :
 * la sélection sur la grille (point C) ne fait plus que déterminer un créneau par **défaut**, ce
 * formulaire permet réellement de créer l'événement — type, titre (réellement optionnel, le
 * backend accepte déjà son absence), description, début/fin ajustables au quart d'heure, et
 * destinataires (`inviteeIds`, jusqu'ici jamais exploités côté front) choisis par nom.
 *
 * Le titre reste facultatif de bout en bout : aucun texte de repli n'est fabriqué à l'envoi, un
 * événement sans titre est envoyé tel quel (`title` omis) — c'est à l'affichage (grille, détail)
 * qu'un repli « Sans titre » est montré, jamais à la création.
 */
export default function EventCreateFormModal({
  ownerId,
  userRole,
  defaultStartAt,
  defaultEndAt,
  weekFrom,
  weekTo,
  onCreated,
  onClose,
}: EventCreateFormModalProps) {
  const allowedTypes: EventType[] = ALLOWED_EVENT_TYPES_BY_ROLE[userRole] ?? []

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEventType, setSelectedEventType] = useState<EventType>(allowedTypes[0] ?? 'rappel')
  const [startAtLocal, setStartAtLocal] = useState(() => toDateTimeLocalValue(defaultStartAt))
  const [endAtLocal, setEndAtLocal] = useState(() => toDateTimeLocalValue(defaultEndAt))
  const [inviteeIds, setInviteeIds] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const { isSaving, errorMessage, submit } = useEventCreate(ownerId)
  const displayedError = validationError ?? errorMessage

  const resolvedStartAt = useMemo(() => fromDateTimeLocalValue(startAtLocal), [startAtLocal])
  const resolvedEndAt = useMemo(() => fromDateTimeLocalValue(endAtLocal), [endAtLocal])
  const isEndAfterStart =
    !resolvedStartAt || !resolvedEndAt || new Date(resolvedEndAt) > new Date(resolvedStartAt)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!resolvedStartAt || !resolvedEndAt) {
      setValidationError('Dates invalides.')
      return
    }
    if (!isEndAfterStart) {
      setValidationError('La fin doit être après le début.')
      return
    }
    setValidationError(null)

    const payload: {
      startAt: string
      endAt: string
      eventType: EventType
      title?: string
      description?: string
      inviteeIds?: string[]
    } = {
      startAt: resolvedStartAt,
      endAt: resolvedEndAt,
      eventType: selectedEventType,
    }
    if (title.trim()) payload.title = title.trim()
    if (description.trim()) payload.description = description.trim()
    if (inviteeIds.length > 0) payload.inviteeIds = inviteeIds

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Créer un événement"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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

        {displayedError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {displayedError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="event-create-type" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="event-create-type"
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

          <div>
            <label htmlFor="event-create-title" className="block text-sm font-medium text-gray-700 mb-1">
              Titre (optionnel — « Sans titre » si laissé vide)
            </label>
            <input
              id="event-create-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Cours de mathématiques"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-create-start" className="block text-sm font-medium text-gray-700 mb-1">
                Début <span className="text-red-500">*</span>
              </label>
              <input
                id="event-create-start"
                type="datetime-local"
                required
                step={900}
                value={startAtLocal}
                onChange={(e) => setStartAtLocal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label htmlFor="event-create-end" className="block text-sm font-medium text-gray-700 mb-1">
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                id="event-create-end"
                type="datetime-local"
                required
                step={900}
                value={endAtLocal}
                onChange={(e) => setEndAtLocal(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-create-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              id="event-create-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précisions sur cet événement…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <EventRecipientPicker
            userRole={userRole}
            selectedIds={inviteeIds}
            onChange={setInviteeIds}
            weekFrom={weekFrom}
            weekTo={weekTo}
          />

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving || !isEndAfterStart}
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
