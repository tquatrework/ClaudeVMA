import React, { useState } from 'react'
import apiClient from '../../api/client'
import {
  CalendarEvent,
  EventType,
  EVENT_TYPE_LABELS,
  ALLOWED_EVENT_TYPES_BY_ROLE,
} from './calendarTypes'

interface EventCreateDialogProps {
  ownerId: string
  userRole: string
  onCreated: (event: CalendarEvent) => void
  onClose: () => void
}

export default function EventCreateDialog({
  ownerId,
  userRole,
  onCreated,
  onClose,
}: EventCreateDialogProps) {
  const allowedTypes: EventType[] = ALLOWED_EVENT_TYPES_BY_ROLE[userRole] ?? ['rappel']

  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [selectedEventType, setSelectedEventType] = useState<EventType>(allowedTypes[0] ?? 'rappel')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isEndAfterStart = !startAt || !endAt || new Date(endAt) > new Date(startAt)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!startAt || !endAt) return
    if (!isEndAfterStart) {
      setErrorMessage('La fin doit être après le début.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const payload: Record<string, unknown> = {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        eventType: selectedEventType,
      }
      if (title.trim()) payload.title = title.trim()
      if (description.trim()) payload.description = description.trim()

      const { data } = await apiClient.post<CalendarEvent>(
        `/calendars/${ownerId}/events`,
        payload,
      )
      onCreated(data)
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErrorMessage(apiMessage ?? "Erreur lors de la création de l'événement")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Créer un événement"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Nouvel événement</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre (optionnel)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Cours de mathématiques"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Début <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endAt}
                min={startAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Description de l'événement…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving || !startAt || !endAt || !isEndAfterStart}
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
