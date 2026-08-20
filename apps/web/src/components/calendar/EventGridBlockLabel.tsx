import React from 'react'
import { EVENT_TYPE_LABELS } from './calendarTypes'
import { formatTimeRangeLabel } from '../../utils/availabilityTime'
import type { CalendarEventGridBlock } from '../../utils/calendarEventGridBlocks'

interface EventGridBlockLabelProps {
  block: CalendarEventGridBlock
}

/**
 * EventGridBlockLabel — contenu superposé à un bloc `EVENT` dans `AvailabilityGrid`
 * (`renderBlockOverlay`, chantier calendrier vue unifiée, point 1). Purement informatif : aucune
 * action inline — le clic sur le bloc (géré par `AvailabilityGrid.onOverlayBlockClick`, voir
 * `CalendarUnifiedView`) ouvre `EventDetailDialog`, qui porte les actions réelles (annulation,
 * rappel), reprises telles quelles de l'ancien onglet "Mes événements".
 */
export default function EventGridBlockLabel({ block }: EventGridBlockLabelProps) {
  const { event, dateLabel } = block
  const isCancelled = event.status === 'cancelled'
  const timeRangeLabel = formatTimeRangeLabel(block.startTime, block.endTime)

  return (
    <div className="min-w-0">
      <span className="block font-medium truncate">
        {event.title ?? EVENT_TYPE_LABELS[event.eventType] ?? 'Événement'}
      </span>
      <span className="block text-[9px] opacity-80 truncate">
        {dateLabel} · {timeRangeLabel}
        {isCancelled ? ' · Annulé' : ''}
      </span>
    </div>
  )
}
