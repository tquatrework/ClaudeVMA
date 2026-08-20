import React from 'react'
import { isAvailabilitySlotBlock, isCalendarEventBlock, type CalendarGridSlot } from '../../utils/calendarUnifiedGridSlot'
import EventGridBlockLabel from './EventGridBlockLabel'
import ActivityGridBlockOverlay from './ActivityGridBlockOverlay'

interface CalendarGridBlockOverlayProps {
  slot: CalendarGridSlot
  onAcceptActivity: (activityId: string) => void
  onDeclineActivity: (activityId: string) => void
  respondingActivityId: string | null
  onJoinVideo: (activityId: string) => void
  isJoiningVideo: boolean
  joiningActivityId: string | null
  revealedActivityId: string | null
}

/**
 * CalendarGridBlockOverlay — dispatche le contenu superposé à un bloc de la grille unifiée selon
 * sa nature (disponibilité éditable → aucun overlay, événement → `EventGridBlockLabel`, activité
 * → `ActivityGridBlockOverlay`). Extrait de `CalendarUnifiedView` pour rester sous la limite de
 * taille de fichier (convention `src/CLAUDE.md`) — aucune logique nouvelle, seul le point de
 * rendu déplacé.
 */
export default function CalendarGridBlockOverlay({
  slot,
  onAcceptActivity,
  onDeclineActivity,
  respondingActivityId,
  onJoinVideo,
  isJoiningVideo,
  joiningActivityId,
  revealedActivityId,
}: CalendarGridBlockOverlayProps): React.ReactNode {
  if (isAvailabilitySlotBlock(slot)) return undefined
  if (isCalendarEventBlock(slot)) return <EventGridBlockLabel block={slot} />
  return (
    <ActivityGridBlockOverlay
      block={slot}
      onAccept={onAcceptActivity}
      onDecline={onDeclineActivity}
      isResponding={respondingActivityId === slot.activity.id}
      onJoinVideo={onJoinVideo}
      isJoiningVideo={isJoiningVideo && joiningActivityId === slot.activity.id}
      isRevealed={revealedActivityId === slot.activity.id}
    />
  )
}
