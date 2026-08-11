/**
 * ArchiveTimeline — historique chronologique des archives d'une personne.
 *
 * Le serveur renvoie la timeline **déjà groupée par date** (`{date, items}`) : on
 * affiche ces groupes tels quels, du plus récent au plus ancien, plutôt que de
 * reconstruire un tri à partir d'un champ `occurredAt` que la timeline ne porte pas.
 * Les libellés de type viennent du point unique `utils/archiveLabels.ts`.
 */

import React from 'react'
import type { ArchiveTimelineGroup } from '../../api/archiveDocument'
import { getArchiveItemTypeColor, getArchiveItemTypeLabel } from '../../utils/archiveLabels'
import { formatIsoCalendarDate } from '../../utils/dateFormat'

interface ArchiveTimelineProps {
  timelineGroups: ArchiveTimelineGroup[]
  onSelectItem: (itemId: string) => void
  selectedItemId?: string | null
  emptyMessage?: string
}

export default function ArchiveTimeline({
  timelineGroups,
  onSelectItem,
  selectedItemId,
  emptyMessage = 'Aucune archive disponible pour cette personne.',
}: ArchiveTimelineProps) {
  if (timelineGroups.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">{emptyMessage}</p>
  }

  const sortedGroups = [...timelineGroups].sort((groupA, groupB) =>
    groupB.date.localeCompare(groupA.date),
  )

  return (
    <div className="space-y-6">
      {sortedGroups.map((group) => (
        <section key={group.date} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {formatIsoCalendarDate(group.date)}
          </h3>

          <ol className="relative border-l border-gray-200 space-y-3 ml-3">
            {group.items.map((item) => {
              const isSelected = selectedItemId === item.id

              return (
                <li key={item.id} className="ml-6">
                  <span
                    className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-2 ring-white ${
                      isSelected ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">
                        {item.title}
                      </p>
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${getArchiveItemTypeColor(
                          item.itemType,
                        )}`}
                      >
                        {getArchiveItemTypeLabel(item.itemType)}
                      </span>
                    </div>
                    {item.pedagogicalPoints > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {item.pedagogicalPoints} point
                        {item.pedagogicalPoints > 1 ? 's' : ''} pédagogique
                        {item.pedagogicalPoints > 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
