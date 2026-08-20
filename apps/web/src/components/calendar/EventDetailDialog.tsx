import React, { useState } from 'react'
import { CalendarEvent } from './calendarTypes'
import { EventCard } from './EventCard'
import CancellationRequestDialog from './CancellationRequestDialog'

interface EventDetailDialogProps {
  event: CalendarEvent
  onClose: () => void
  /** Remonte l'annulation au propriétaire de l'état (`CalendarUnifiedView`), qui met à jour la
   * liste d'événements — règle du 2026-08-10 : une donnée de page appartient à la page. */
  onEventCancelled: (eventId: string) => void
}

/**
 * EventDetailDialog — détail d'un événement de calendrier, ouvert par clic sur son bloc dans la
 * grille unifiée (chantier calendrier vue unifiée, point 1). Reprend telle quelle la carte
 * `EventCard` (titre, horaires, description, badge de type, demande d'annulation, configuration
 * de rappel) déjà utilisée par l'ancien onglet « Mes événements » — aucune fonctionnalité perdue,
 * seul le point d'accès change (clic sur la grille plutôt qu'un item de liste).
 */
export default function EventDetailDialog({
  event,
  onClose,
  onEventCancelled,
}: EventDetailDialogProps) {
  const [isReminderExpanded, setIsReminderExpanded] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const isPast = new Date(event.startAt) < new Date()

  const handleCancelled = () => {
    onEventCancelled(event.id)
    setIsCancelling(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Détail de l'événement"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Détail de l'événement</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <ul>
          <EventCard
            event={event}
            isPast={isPast}
            onRequestCancellation={() => setIsCancelling(true)}
            isReminderExpanded={isReminderExpanded}
            onToggleReminder={() => setIsReminderExpanded((previous) => !previous)}
          />
        </ul>
      </div>

      {isCancelling && (
        <CancellationRequestDialog
          eventId={event.id}
          eventTitle={event.title || 'Sans titre'}
          onCancelled={handleCancelled}
          onClose={() => setIsCancelling(false)}
        />
      )}
    </div>
  )
}
