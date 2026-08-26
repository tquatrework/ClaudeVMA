/**
 * LogEntryAttachments — pièces jointes d'une entrée de cahier de texte.
 *
 * Repliée par défaut (cohérent avec le formulaire de nouvelle entrée,
 * 2026-08-21) : les pièces jointes ne se chargent qu'au premier dépliage, pour
 * ne pas multiplier les requêtes sur une longue liste d'entrées.
 *
 * Deux publics dans un seul composant :
 * - **tout lecteur** de l'entrée (élève, parent, formateur, RP selon la
 *   catégorie de visibilité déjà appliquée au niveau de l'entrée) peut déplier
 *   et télécharger ;
 * - **le formateur auteur** (`canManage`) peut en plus joindre et supprimer.
 *
 * Le bouton « Joindre un fichier » n'apparaît que si `attachmentSettings.
 * attachmentsEnabled` est vrai — lu par la page avant le rendu (même
 * discipline que `GET /profiles/avatar/constraints`), jamais affiché puis
 * refusé en 403.
 */

import React, { useId, useRef, useState } from 'react'
import type { PedagogicalLogAttachment, PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import { useLogEntryAttachments } from '../../hooks/pedagogical-log/useLogEntryAttachments'
import { formatFileSize } from '../../utils/fileSize'
import { ATTACHMENT_LABELS, getAttachmentMaxSizeHint } from '../../utils/logAttachment'
import { ErrorMessage } from '../ui/ErrorMessage'

interface LogEntryAttachmentsProps {
  logId: string
  canManage: boolean
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
  const [isExpanded, setIsExpanded] = useState(false)
  const hasRequestedLoad = useRef(false)
  const fileInputId = useId()

  const {
    attachments,
    isLoadingAttachments,
    loadError,
    loadAttachments,
    uploadAttachment,
    isUploadingAttachment,
    uploadError,
    dismissUploadError,
    deleteAttachment,
    deletingAttachmentId,
    deleteError,
    downloadAttachment,
    downloadingAttachmentId,
    downloadError,
  } = useLogEntryAttachments(logId)

  const handleToggle = () => {
    const nextExpanded = !isExpanded
    setIsExpanded(nextExpanded)
    if (nextExpanded && !hasRequestedLoad.current) {
      hasRequestedLoad.current = true
      void loadAttachments()
    }
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''
    if (!selectedFile) return
    await uploadAttachment(
      selectedFile,
      attachmentSettings.maxFileBytes,
      attachmentSettings.maxTotalBytesPerEntry,
    )
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs text-gray-500 hover:underline"
      >
        {isExpanded ? ATTACHMENT_LABELS.toggleHide : ATTACHMENT_LABELS.toggleShow}
      </button>

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

          {canManage && attachmentSettings.attachmentsEnabled && (
            <div className="mt-2">
              <label
                htmlFor={fileInputId}
                className={`inline-flex cursor-pointer items-center text-xs text-indigo-600 hover:underline ${
                  isUploadingAttachment ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                {isUploadingAttachment ? ATTACHMENT_LABELS.uploading : ATTACHMENT_LABELS.addAction}
              </label>
              <input
                id={fileInputId}
                type="file"
                className="sr-only"
                disabled={isUploadingAttachment}
                onChange={handleFileSelected}
              />
              <p className="mt-0.5 text-xs text-gray-400">
                {getAttachmentMaxSizeHint(attachmentSettings.maxFileBytes)}
              </p>
              {uploadError && (
                <ErrorMessage
                  message={uploadError}
                  onClose={dismissUploadError}
                  className="mt-1 text-xs"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
