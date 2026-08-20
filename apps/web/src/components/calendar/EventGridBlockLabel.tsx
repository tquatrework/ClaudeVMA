import React from 'react'
import { formatTimeRangeLabel } from '../../utils/availabilityTime'
import type { CalendarEventGridBlock } from '../../utils/calendarEventGridBlocks'

interface EventGridBlockLabelProps {
  block: CalendarEventGridBlock
}

/**
 * EventGridBlockLabel — contenu superposé à un bloc `EVENT`/`EVENT_PENDING` dans
 * `AvailabilityGrid` (`renderBlockOverlay`, chantier calendrier vue unifiée, point 1). Purement
 * informatif : aucune action inline — le clic sur le bloc (géré par
 * `AvailabilityGrid.onOverlayBlockClick`, voir `CalendarUnifiedView`) ouvre `EventDetailDialog`,
 * qui porte les actions réelles (annulation, rappel, et depuis le 2026-08-20 Accepter/Refuser
 * pour une invitation en attente, Supprimer pour le créateur).
 */
export default function EventGridBlockLabel({ block }: EventGridBlockLabelProps) {
  const { event, dateLabel } = block
  const isCancelled = event.status === 'cancelled'
  const isPendingInvitation = event.viewerInvitationStatus === 'pending'
  const timeRangeLabel = formatTimeRangeLabel(block.startTime, block.endTime)

  return (
    <div className="min-w-0">
      <span className="block font-medium truncate">{event.title || 'Sans titre'}</span>
      <span className="block text-[9px] opacity-80 truncate">
        {dateLabel} · {timeRangeLabel}
        {isCancelled ? ' · Annulé' : ''}
      </span>
      {isPendingInvitation && (
        <span className="block text-[9px] italic opacity-70 truncate">
          Invitation — cliquer pour répondre
        </span>
      )}
    </div>
  )
}
