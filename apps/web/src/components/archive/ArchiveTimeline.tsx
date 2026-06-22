/**
 * ArchiveTimeline — Phase 11
 *
 * Affiche une timeline chronologique des éléments d'archive d'un élève.
 * Les éléments sont triés du plus récent au plus ancien.
 * Les types d'archives sont présentés avec une icône textuelle et un libellé.
 */

import React from 'react'
import type { ArchiveTimelineEntry, ArchiveItemType } from '../../api/archiveDocument'

const ITEM_TYPE_LABELS: Record<ArchiveItemType, string> = {
  pedagogical_log: 'Cahier de texte',
  course_summary: 'Résumé de cours',
  notebook_entry: 'Carnet personnel',
  recording: 'Enregistrement',
  content_catalog: 'Contenu pédagogique',
}

const ITEM_TYPE_COLORS: Record<ArchiveItemType, string> = {
  pedagogical_log: 'bg-blue-100 text-blue-700',
  course_summary: 'bg-green-100 text-green-700',
  notebook_entry: 'bg-purple-100 text-purple-700',
  recording: 'bg-orange-100 text-orange-700',
  content_catalog: 'bg-gray-100 text-gray-700',
}

interface ArchiveTimelineProps {
  timelineEntries: ArchiveTimelineEntry[]
  onSelectEntry: (entryId: string) => void
  selectedEntryId?: string | null
}

export default function ArchiveTimeline({
  timelineEntries,
  onSelectEntry,
  selectedEntryId,
}: ArchiveTimelineProps) {
  if (timelineEntries.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-8">
        Aucune archive disponible pour cet élève.
      </p>
    )
  }

  const sortedEntries = [...timelineEntries].sort(
    (entryA, entryB) =>
      new Date(entryB.occurredAt).getTime() - new Date(entryA.occurredAt).getTime(),
  )

  return (
    <ol className="relative border-l border-gray-200 space-y-6 ml-3">
      {sortedEntries.map((entry) => {
        const isSelected = selectedEntryId === entry.id
        const typeLabel = ITEM_TYPE_LABELS[entry.itemType] ?? entry.itemType
        const typeColor = ITEM_TYPE_COLORS[entry.itemType] ?? 'bg-gray-100 text-gray-700'

        return (
          <li key={entry.id} className="ml-6">
            {/* Timeline dot */}
            <span
              className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-2 ring-white ${
                isSelected ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />

            <button
              type="button"
              onClick={() => onSelectEntry(entry.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                isSelected
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{entry.title}</p>
                  {entry.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{entry.description}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}
                >
                  {typeLabel}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(entry.occurredAt).toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
