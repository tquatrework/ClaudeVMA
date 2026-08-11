/**
 * CourseSummaryArchiveView — vue filtrée sur les résumés de cours.
 *
 * Les résumés de cours sont permanents : ils survivent à l'expiration de
 * l'enregistrement vidéo (VID-AC-002). Le type serveur est `resume_de_cours` —
 * `course_summary` n'a jamais existé côté serveur, ce qui vidait cet onglet.
 */

import React from 'react'
import type { PedagogicalArchiveItem } from '../../api/archiveDocument'
import { formatLocalDate } from '../../utils/dateFormat'

interface CourseSummaryArchiveViewProps {
  allArchiveItems: PedagogicalArchiveItem[]
}

export default function CourseSummaryArchiveView({
  allArchiveItems,
}: CourseSummaryArchiveViewProps) {
  const courseSummaryItems = allArchiveItems.filter(
    (item) => item.itemType === 'resume_de_cours',
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
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{summary.title}</p>
              {summary.description && (
                <p className="text-xs text-gray-500 line-clamp-3">{summary.description}</p>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Séance du {formatLocalDate(summary.occurredAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
