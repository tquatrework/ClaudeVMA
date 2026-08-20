import React, { useState } from 'react'
import { CalendarEvent } from './calendarTypes'
import { EventCard } from './EventCard'
import CancellationRequestDialog from './CancellationRequestDialog'

interface EventDetailDialogProps {
  event: CalendarEvent
  /**
   * Identifiant de l'utilisateur qui consulte ce détail — permet de savoir s'il est le créateur
   * de l'événement (bouton "Supprimer", réservé au créateur, point 4) ; l'invitation à
   * accepter/refuser se lit directement sur `event.viewerInvitationStatus`, déjà résolu par le
   * serveur pour ce même titulaire.
   */
  viewerId: string
  onClose: () => void
  /** Remonte l'annulation au propriétaire de l'état (`CalendarUnifiedView`), qui met à jour la
   * liste d'événements — règle du 2026-08-10 : une donnée de page appartient à la page. */
  onEventCancelled: (eventId: string) => void
  isRespondingToInvitation: boolean
  invitationResponseError: string | null
  onRespondToInvitation: (eventId: string, action: 'accept' | 'decline') => void
  isDeleting: boolean
  deleteError: string | null
  onDeleteEvent: (eventId: string) => void
}

/**
 * EventDetailDialog — détail d'un événement de calendrier, ouvert par clic sur son bloc dans la
 * grille unifiée (chantier calendrier vue unifiée, point 1). Reprend telle quelle la carte
 * `EventCard` (titre, horaires, description, badge de type, demande d'annulation, configuration
 * de rappel) déjà utilisée par l'ancien onglet « Mes événements ».
 *
 * **Bug réel corrigé le 2026-08-20** (invitation d'événement invisible pour l'invité). Quand
 * `event.viewerInvitationStatus === "pending"`, la modale porte désormais Accepter/Refuser —
 * remplace `InvitationBanner` (bandeau séparé au-dessus de la grille, retiré le même jour) qui ne
 * pouvait jamais s'afficher pour une invitation réelle : il testait `eventType === "invitation"`
 * et un champ `inviteeStatus` que calendar-service n'a jamais renvoyé. Voir
 * `CalendarUnifiedView` pour le retrait, et `docs/routes.md` § calendar-service pour le contrat
 * réel (`viewerInvitationStatus`).
 *
 * **Suppression (point 4, même session)** : bouton visible pour le seul créateur
 * (`event.ownerId === viewerId`) — `DELETE /calendars/:ownerId/events/:eventId`, route ajoutée le
 * même jour côté serveur.
 */
export default function EventDetailDialog({
  event,
  viewerId,
  onClose,
  onEventCancelled,
  isRespondingToInvitation,
  invitationResponseError,
  onRespondToInvitation,
  isDeleting,
  deleteError,
  onDeleteEvent,
}: EventDetailDialogProps) {
  const [isReminderExpanded, setIsReminderExpanded] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const isPast = new Date(event.startAt) < new Date()
  const isPendingInvitation = event.viewerInvitationStatus === 'pending'
  const isCreator = event.ownerId === viewerId

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

        {isPendingInvitation && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800 mb-2">
              Vous êtes invité(e) à cet événement — acceptez-vous d'y participer ?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onRespondToInvitation(event.id, 'accept')}
                disabled={isRespondingToInvitation}
                className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Accepter
              </button>
              <button
                type="button"
                onClick={() => onRespondToInvitation(event.id, 'decline')}
                disabled={isRespondingToInvitation}
                className="flex-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Refuser
              </button>
            </div>
            {invitationResponseError && (
              <p className="text-xs text-red-600 mt-2">{invitationResponseError}</p>
            )}
          </div>
        )}

        <ul>
          <EventCard
            event={event}
            isPast={isPast}
            onRequestCancellation={() => setIsCancelling(true)}
            isReminderExpanded={isReminderExpanded}
            onToggleReminder={() => setIsReminderExpanded((previous) => !previous)}
          />
        </ul>

        {isCreator && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => onDeleteEvent(event.id)}
              disabled={isDeleting}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {isDeleting ? 'Suppression…' : "Supprimer l'événement"}
            </button>
            {deleteError && <p className="text-xs text-red-600 mt-1">{deleteError}</p>}
          </div>
        )}
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
