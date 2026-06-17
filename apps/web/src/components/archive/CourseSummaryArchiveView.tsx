/**
 * CourseSummaryArchiveView — Phase 11
 *
 * Vue filtrée sur les résumés de cours dans les archives pédagogiques.
 * Les résumés de cours sont permanents (survivent à l'expiration de l'enregistrement vidéo).
 * VID-AC-002 : isPermanent = true garantit la disponibilité longue durée.
 */

import React from 'react'
import type { PedagogicalArchiveItem } from '../../api/archiveDocument'

interface CourseSummaryArchiveViewProps {
  allArchiveItems: PedagogicalArchiveItem[]
}

export default function CourseSummaryArchiveView({
  allArchiveItems,
}: CourseSummaryArchiveViewProps) {
  const courseSummaryItems = allArchiveItems.filter(
    (item) => item.itemType === 'course_summary',
  )

  if (courseSummaryItems.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm">Aucun résumé de cours archivé.</p>
        <p className="text-gray-300 text-xs mt-1">
          Les résumés publiés après les séances apparaîtront ici.
        </p>
      </div>
    )
  }

  const sortedSummaries = [...courseSummaryItems].sort(
    (summaryA, summaryB) =>
      new Date(summaryB.occurredAt).getTime() - new Date(summaryA.occurredAt).getTime(),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700">
          Résumés de cours ({sortedSummaries.length})
        </h3>
        <span className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-full px-2 py-0.5">
          Conservation permanente
        </span>
      </div>

      <ul className="space-y-3">
        {sortedSummaries.map((summary) => (
          <li
            key={summary.id}
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{summary.title}</p>
                {summary.description && (
                  <p className="text-xs text-gray-500 line-clamp-3">{summary.description}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Séance du{' '}
              {new Date(summary.occurredAt).toLocaleDateString('fr-FR', {
                dateStyle: 'long',
              })}
            </p>
            {summary.sourceUrl && (
              <a
                href={summary.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-indigo-600 hover:underline"
              >
                Voir le détail de la séance
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
