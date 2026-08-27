/**
 * LogEntryAttachments — pièces jointes d'une entrée de cahier de texte déjà
 * créée : liste, téléchargement, et — en mode édition seulement — ajout et
 * suppression.
 *
 * Révision du 2026-08-27 (second correctif du jour, deux défauts remontés par
 * test utilisateur réel) :
 *
 * 1. **L'ajout et la suppression sont réservés au mode édition.** Une entrée
 *    en cours de modification (`canManage`, formateur auteur, `isEditing`
 *    dans `PedagogicalLogEntryItem`) redonne le même niveau de contrôle qu'une
 *    entrée non encore créée : voir les pièces jointes existantes, en ajouter
 *    une (envoi immédiat, l'entrée existe déjà — pas besoin de différer
 *    l'envoi comme `useNewLogEntryForm`), et en supprimer une. **Hors édition,
 *    la section est toujours en lecture seule, pour tous les rôles, y compris
 *    le formateur auteur** — la suppression, auparavant disponible en simple
 *    affichage pour le formateur, migre donc elle aussi vers le mode édition
 *    uniquement, par cohérence avec ce même principe.
 * 2. **Plus de dépliage préalable.** Tout lecteur (élève, parent, formateur,
 *    RP) voit directement les noms des pièces jointes et le bouton de
 *    téléchargement, chargés au montage — l'ancienne distinction
 *    `canManage`/lecteur sur l'affichage repliée par défaut a disparu.
 */

import React, { useEffect, useId, useRef } from 'react'
import type { PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import type { PedagogicalLogAttachment } from '../../api/pedagogicalLogAttachments'
import { useLogEntryAttachments } from '../../hooks/pedagogical-log/useLogEntryAttachments'
import { formatFileSize } from '../../utils/fileSize'
import { ATTACHMENT_LABELS, getAttachmentMaxSizeHint } from '../../utils/logAttachment'
import { ErrorMessage } from '../ui/ErrorMessage'

interface LogEntryAttachmentsProps {
  logId: string
  /**
   * Autorise l'ajout et la suppression d'une pièce jointe — vrai uniquement
   * en mode édition, pour le formateur auteur. En dehors, la section reste
   * en lecture seule pour tous les rôles.
   */
  canManage: boolean
  /** Réglages système — n'a d'effet que lorsque `canManage` est vrai. */
  attachmentSettings: PedagogicalLogAttachmentSettings
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

export function LogEntryAttachments({ logId, canManage, attachmentSettings }: LogEntryAttachmentsProps) {
  const hasRequestedLoad = useRef(false)
  const attachmentInputId = useId()

  const {
    attachments,
    isLoadingAttachments,
    loadError,
    loadAttachments,
    uploadAttachment,
    isUploadingAttachment,
    uploadError,
    deleteAttachment,
    deletingAttachmentId,
    deleteError,
    downloadAttachment,
    downloadingAttachmentId,
    downloadError,
  } = useLogEntryAttachments(logId)

  // Chargement au montage, sans condition de rôle : tout lecteur voit les
  // pièces jointes directement, sans dépliage préalable.
  useEffect(() => {
    if (!hasRequestedLoad.current) {
      hasRequestedLoad.current = true
      void loadAttachments()
    }
  }, [loadAttachments])

  const handleSelectFile = (file: File | null) => {
    if (!file) return
    void uploadAttachment(file, attachmentSettings.maxFileBytes, attachmentSettings.maxTotalBytesPerEntry)
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <p className="text-xs font-semibold text-gray-500">{ATTACHMENT_LABELS.sectionTitle}</p>

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

        {canManage && attachmentSettings.attachmentsEnabled && (
          <div className="mt-2">
            {isUploadingAttachment ? (
              <p className="text-xs text-gray-400">{ATTACHMENT_LABELS.uploading}</p>
            ) : (
              <>
                <label
                  htmlFor={attachmentInputId}
                  className="cursor-pointer text-xs text-indigo-500 hover:underline"
                >
                  {`+ ${ATTACHMENT_LABELS.addAction}`}
                </label>
                <input
                  id={attachmentInputId}
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null
                    handleSelectFile(selectedFile)
                    event.target.value = ''
                  }}
                />
                <p className="mt-0.5 text-xs text-gray-400">
                  {getAttachmentMaxSizeHint(attachmentSettings.maxFileBytes)}
                </p>
              </>
            )}
            {uploadError && (
              <ErrorMessage message={uploadError} variant="warning" className="mt-1 text-xs" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
