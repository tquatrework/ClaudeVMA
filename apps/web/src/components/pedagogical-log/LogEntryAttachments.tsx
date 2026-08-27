/**
 * LogEntryAttachments — pièces jointes d'une entrée de cahier de texte déjà
 * créée : liste, téléchargement et suppression uniquement.
 *
 * Deux publics dans un seul composant :
 * - **tout lecteur** de l'entrée (élève, parent, formateur, RP selon la
 *   catégorie de visibilité déjà appliquée au niveau de l'entrée) peut déplier
 *   et télécharger ;
 * - **le formateur auteur** (`canManage`) peut en plus supprimer.
 *
 * Ajout retiré le 2026-08-27 (décision explicite de l'utilisateur, qui
 * restreint le périmètre posé le 2026-08-26) : une pièce jointe ne se joint
 * plus qu'**au moment de la création** d'une entrée (`NewLogPageForm` /
 * `useNewLogEntryForm`) — il n'y a donc plus de point d'ajout ici, sur une
 * entrée déjà créée. La liste des pièces jointes déjà présentes, leur
 * téléchargement et leur suppression restent inchangés.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { PedagogicalLogAttachment } from '../../api/pedagogicalLogAttachments'
import { useLogEntryAttachments } from '../../hooks/pedagogical-log/useLogEntryAttachments'
import { formatFileSize } from '../../utils/fileSize'
import { ATTACHMENT_LABELS } from '../../utils/logAttachment'
import { ErrorMessage } from '../ui/ErrorMessage'

interface LogEntryAttachmentsProps {
  logId: string
  /** Autorise la suppression d'une pièce jointe existante (le formateur auteur). */
  canManage: boolean
}

function AttachmentRow({
  attachment,
  canManage,
  onDownload,
  isDownloading,
  onDelete,
  isDeleting,
}: {
  attachment: PedagogicalLogAttachment
  canManage: boolean
  onDownload: () => void
  isDownloading: boolean
  onDelete: () => void
  isDeleting: boolean
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <div className="min-w-0">
        <p className="truncate text-gray-800">{attachment.originalFilename}</p>
        <p className="text-xs text-gray-400">{formatFileSize(attachment.sizeBytes) ?? ''}</p>
      </div>
      <div className="flex shrink-0 gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="text-xs text-indigo-500 hover:underline disabled:opacity-50"
        >
          {isDownloading ? ATTACHMENT_LABELS.downloading : ATTACHMENT_LABELS.downloadAction}
        </button>
        {canManage && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs text-red-400 hover:underline disabled:opacity-50"
          >
            {isDeleting ? ATTACHMENT_LABELS.deleting : ATTACHMENT_LABELS.deleteAction}
          </button>
        )}
      </div>
    </li>
  )
}

export function LogEntryAttachments({ logId, canManage }: LogEntryAttachmentsProps) {
  // Dépliée par défaut pour le formateur qui peut gérer les pièces jointes
  // (suppression) — repliée par défaut pour un simple lecteur, inchangé.
  const [isExpanded, setIsExpanded] = useState(canManage)
  const hasRequestedLoad = useRef(false)

  const {
    attachments,
    isLoadingAttachments,
    loadError,
    loadAttachments,
    deleteAttachment,
    deletingAttachmentId,
    deleteError,
    downloadAttachment,
    downloadingAttachmentId,
    downloadError,
  } = useLogEntryAttachments(logId)

  useEffect(() => {
    if (canManage && !hasRequestedLoad.current) {
      hasRequestedLoad.current = true
      void loadAttachments()
    }
  }, [canManage, loadAttachments])

  const handleToggle = () => {
    const nextExpanded = !isExpanded
    setIsExpanded(nextExpanded)
    if (nextExpanded && !hasRequestedLoad.current) {
      hasRequestedLoad.current = true
      void loadAttachments()
    }
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      {canManage ? (
        <p className="text-xs font-semibold text-gray-500">{ATTACHMENT_LABELS.sectionTitle}</p>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className="text-xs text-gray-500 hover:underline"
        >
          {isExpanded ? ATTACHMENT_LABELS.toggleHide : ATTACHMENT_LABELS.toggleShow}
        </button>
      )}

      {isExpanded && (
        <div className="mt-2">
          {isLoadingAttachments && (
            <p className="text-xs text-gray-400">{ATTACHMENT_LABELS.loading}</p>
          )}

          {loadError && <ErrorMessage message={loadError} variant="warning" className="text-xs" />}

          {!isLoadingAttachments && !loadError && (attachments?.length ?? 0) === 0 && (
            <p className="text-xs text-gray-400">{ATTACHMENT_LABELS.empty}</p>
          )}

          {!isLoadingAttachments && (attachments?.length ?? 0) > 0 && (
            <ul className="divide-y divide-gray-50">
              {attachments!.map((attachment) => (
                <AttachmentRow
                  key={attachment.id}
                  attachment={attachment}
                  canManage={canManage}
                  onDownload={() => downloadAttachment(attachment)}
                  isDownloading={downloadingAttachmentId === attachment.id}
                  onDelete={() => deleteAttachment(attachment.id)}
                  isDeleting={deletingAttachmentId === attachment.id}
                />
              ))}
            </ul>
          )}

          {downloadError && (
            <ErrorMessage message={downloadError} variant="warning" className="mt-1 text-xs" />
          )}
          {deleteError && <ErrorMessage message={deleteError} variant="warning" className="mt-1 text-xs" />}
        </div>
      )}
    </div>
  )
}
