import React from 'react'
import { getActivityTypeLabel } from '../../utils/activityLabels'
import { formatTimeRangeLabel } from '../../utils/availabilityTime'
import {
  getActivityCreatorFallbackLabel,
  type ScheduledActivityGridBlock,
} from '../../utils/scheduledActivityGridBlocks'

interface ActivityGridBlockOverlayProps {
  block: ScheduledActivityGridBlock
  onAccept: (activityId: string) => void
  onDecline: (activityId: string) => void
  isResponding: boolean
  /** Chantier calendrier-visio-livekit, point 2 : rejoindre la salle vidéo créée
   * automatiquement pour un cours confirmé. Absent (ou omis) sur les blocs qui n'y ont pas
   * droit — voir la condition d'affichage ci-dessous. */
  onJoinVideo?: (activityId: string) => void
  isJoiningVideo?: boolean
}

/**
 * ActivityGridBlockOverlay — contenu superposé à un bloc `PROPOSED`/`CONFIRMED` dans
 * `AvailabilityGrid` (`renderBlockOverlay`, chantier calendrier de disponibilités, point 3).
 * `PROPOSED` porte les actions Accepter/Refuser inline. `CONFIRMED` reste informatif, sauf pour
 * un `cours` : il porte alors un bouton "Rejoindre le cours" (point 2 du chantier
 * calendrier-visio-livekit) qui résout la salle vidéo créée automatiquement à l'acceptation du
 * créneau, sans jamais afficher l'`activityId` ni un id de salle.
 *
 * N'affiche jamais `creatorId`/`participantIds` bruts — seulement `activity.creatorName`, ou un
 * texte neutre en français si le serveur ne l'a pas résolu (arbitrage du 2026-08-09).
 */
export default function ActivityGridBlockOverlay({
  block,
  onAccept,
  onDecline,
  isResponding,
  onJoinVideo,
  isJoiningVideo,
}: ActivityGridBlockOverlayProps) {
  const { activity, dateLabel } = block
  const creatorLabel = activity.creatorName?.trim() || getActivityCreatorFallbackLabel(activity.type)
  const timeRangeLabel = formatTimeRangeLabel(block.startTime, block.endTime)

  return (
    <div className="h-full flex flex-col justify-between gap-0.5">
      <div className="min-w-0">
        <span className="block font-medium truncate">{getActivityTypeLabel(activity.type)}</span>
        <span className="block truncate">{creatorLabel}</span>
        <span className="block text-[9px] opacity-80 truncate">
          {dateLabel} · {timeRangeLabel}
        </span>
      </div>

      {block.kind === 'PROPOSED' && (
        <div className="flex gap-1 mt-0.5">
          <button
            type="button"
            onClick={() => onAccept(activity.id)}
            disabled={isResponding}
            aria-label={`Accepter la proposition de cours du ${dateLabel} ${timeRangeLabel} avec ${creatorLabel}`}
            className="flex-1 rounded bg-green-600 text-white text-[9px] font-medium py-0.5 hover:bg-green-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
          >
            Accepter
          </button>
          <button
            type="button"
            onClick={() => onDecline(activity.id)}
            disabled={isResponding}
            aria-label={`Refuser la proposition de cours du ${dateLabel} ${timeRangeLabel} avec ${creatorLabel}`}
            className="flex-1 rounded bg-red-600 text-white text-[9px] font-medium py-0.5 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Refuser
          </button>
        </div>
      )}

      {block.kind === 'CONFIRMED' && activity.type === 'cours' && onJoinVideo && (
        <div className="mt-0.5">
          <button
            type="button"
            onClick={() => onJoinVideo(activity.id)}
            disabled={isJoiningVideo}
            aria-label={`Rejoindre le cours du ${dateLabel} ${timeRangeLabel} avec ${creatorLabel}`}
            className="w-full rounded bg-indigo-600 text-white text-[9px] font-medium py-0.5 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {isJoiningVideo ? 'Connexion…' : 'Rejoindre le cours'}
          </button>
        </div>
      )}
    </div>
  )
}
