/**
 * ArchiveItemDetail — Phase 11
 *
 * Affiche le détail d'un élément d'archive sélectionné.
 * Propose les actions disponibles : ouvrir le lien source, télécharger le document.
 * Les carnet personnel restent réservés à l'élève (l'UI n'affiche pas le bouton pour le parent).
 */

import React from 'react'
import type { PedagogicalArchiveItem, ArchiveItemType } from '../../api/archiveDocument'

const ITEM_TYPE_LABELS: Record<ArchiveItemType, string> = {
  pedagogical_log: 'Cahier de texte',
  course_summary: 'Résumé de cours',
  notebook_entry: 'Carnet personnel',
  recording: 'Enregistrement',
  content_catalog: 'Contenu pédagogique',
}

interface ArchiveItemDetailProps {
  archiveItem: PedagogicalArchiveItem
  canAccessNotebook: boolean
  isDownloadingDocument: boolean
  onDownload: (documentId: string) => void
}

export default function ArchiveItemDetail({
  archiveItem,
  canAccessNotebook,
  isDownloadingDocument,
  onDownload,
}: ArchiveItemDetailProps) {
  const typeLabel = ITEM_TYPE_LABELS[archiveItem.itemType] ?? archiveItem.itemType
  const isNotebookEntry = archiveItem.itemType === 'notebook_entry'
  const hasSourceLink = Boolean(archiveItem.sourceUrl)
  const hasDownloadLink = Boolean(archiveItem.downloadUrl)

  // Un parent financeur ne peut pas accéder aux entrées de carnet personnel
  const isAccessBlocked = isNotebookEntry && !canAccessNotebook

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      {/* En-tête */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">{archiveItem.title}</h2>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            {typeLabel}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {new Date(archiveItem.occurredAt).toLocaleString('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        </p>
      </div>

      {/* Accès bloqué pour le parent financeur sur le carnet personnel */}
      {isAccessBlocked ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Ce document est réservé à l'élève. Le parent financeur n'a pas accès au carnet
          personnel.
        </div>
      ) : (
        <>
          {/* Description */}
          {archiveItem.description && (
            <p className="text-sm text-gray-700">{archiveItem.description}</p>
          )}

          {/* Résumé de cours permanent */}
          {archiveItem.itemType === 'course_summary' && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              Ce résumé est permanent et reste accessible même après expiration de
              l'enregistrement vidéo.
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {hasSourceLink && (
              <a
                href={archiveItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors"
              >
                Ouvrir la source
              </a>
            )}

            {hasDownloadLink && (
              <ArchiveDocumentDownload
                documentId={archiveItem.id}
                isDownloading={isDownloadingDocument}
                onDownload={onDownload}
              />
            )}

            {!hasSourceLink && !hasDownloadLink && (
              <p className="text-xs text-gray-400 italic">
                Aucun lien ou fichier associé à cette archive.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sous-composant download ───────────────────────────────────────────────────

interface ArchiveDocumentDownloadProps {
  documentId: string
  isDownloading: boolean
  onDownload: (documentId: string) => void
}

export function ArchiveDocumentDownload({
  documentId,
  isDownloading,
  onDownload,
}: ArchiveDocumentDownloadProps) {
  return (
    <button
      type="button"
      onClick={() => onDownload(documentId)}
      disabled={isDownloading}
      className="inline-flex items-center gap-1.5 text-sm bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
    >
      {isDownloading ? 'Téléchargement…' : 'Télécharger'}
    </button>
  )
}
