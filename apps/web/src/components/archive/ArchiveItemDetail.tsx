/**
 * ArchiveItemDetail — détail d'un élément d'archive sélectionné.
 *
 * Le carnet personnel reste réservé à l'élève : le parent financeur ne le reçoit
 * même pas du serveur (il est filtré de la liste), mais le message de restriction
 * est conservé pour les rares cas où un élément filtré transiterait quand même.
 * Aucun champ `sourceUrl` n'existe côté serveur : seul `downloadUrl` ouvre une
 * action, et le téléchargement passe par `GET /documents/:id/download`.
 */

import React from 'react'
import type { PedagogicalArchiveItem } from '../../api/archiveDocument'
import { getArchiveItemTypeLabel } from '../../utils/archiveLabels'
import { formatLocalDateTime } from '../../utils/dateFormat'

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
  const typeLabel = getArchiveItemTypeLabel(archiveItem.itemType)
  const isNotebookEntry = archiveItem.itemType === 'carnet_personnel'
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
        <p className="text-xs text-gray-400">{formatLocalDateTime(archiveItem.occurredAt)}</p>
      </div>

      {/* Accès bloqué pour le parent financeur sur le carnet personnel */}
      {isAccessBlocked ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Ce document est réservé à l'élève. Le parent financeur n'a pas accès au carnet
          personnel.
        </div>
      ) : (
        <>
          {archiveItem.description && (
            <p className="text-sm text-gray-700">{archiveItem.description}</p>
          )}

          {archiveItem.score !== null && (
            <p className="text-sm text-gray-700">Note obtenue : {archiveItem.score}</p>
          )}

          {archiveItem.itemType === 'resume_de_cours' && (
            <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              Ce résumé est permanent et reste accessible même après expiration de
              l'enregistrement vidéo.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {hasDownloadLink ? (
              <ArchiveDocumentDownload
                documentId={archiveItem.id}
                isDownloading={isDownloadingDocument}
                onDownload={onDownload}
              />
            ) : (
              <p className="text-xs text-gray-400 italic">
                Aucun fichier associé à cette archive.
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
