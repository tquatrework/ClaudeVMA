/**
 * useLogEntryAttachments — pièces jointes d'une entrée de cahier de texte
 * déjà créée : chargement, envoi, téléchargement et suppression.
 *
 * Ajout réintroduit le 2026-08-27 (second correctif du jour, après un premier
 * retrait trop large) : l'édition d'une entrée déjà créée doit redonner le
 * même niveau de contrôle qu'une nouvelle entrée non encore validée, pièce
 * jointe comprise — voir `LogEntryAttachments`, qui n'ouvre `uploadAttachment`
 * qu'en mode édition (`canManage`). Le refus local avant envoi reprend la
 * même logique que `useNewLogEntryForm.onSelectAttachment` (comparaison au
 * plafond par fichier connu du réglage système, message uniforme).
 *
 * Chargement **au montage**, sans condition de rôle (second correctif du
 * 2026-08-27) : tout lecteur d'une entrée doit voir les noms des pièces
 * jointes et le bouton de téléchargement directement, sans dépliage
 * préalable — voir `LogEntryAttachments`, qui appelait auparavant
 * `loadAttachments` seulement pour le formateur au montage, et au premier
 * dépliage pour les autres lecteurs.
 *
 * Téléchargement authentifié : même pattern que `PedagogicalArchivePage`
 * (`downloadArchiveDocument` + object URL + ancre temporaire) — la route est
 * protégée par le JWT de l'en-tête `Authorization`, qu'une balise `<a href>`
 * brute n'envoie pas.
 */

import { useCallback, useState } from 'react'
import {
  deleteLogAttachment,
  fetchLogAttachmentBlob,
  fetchLogAttachments,
  uploadLogAttachment,
  type PedagogicalLogAttachment,
} from '../../api/pedagogicalLogAttachments'
import {
  getAttachmentDeleteErrorMessage,
  getAttachmentDownloadErrorMessage,
  getAttachmentLoadErrorMessage,
  getAttachmentTooLargeMessage,
  getAttachmentUploadErrorMessage,
} from '../../utils/logAttachment'
import { isAvatarFileTooLarge } from '../../utils/profileAvatarConstraints'

export interface UseLogEntryAttachmentsResult {
  attachments: PedagogicalLogAttachment[] | null
  isLoadingAttachments: boolean
  loadError: string | null
  loadAttachments: () => Promise<void>

  uploadAttachment: (file: File, maxFileBytes: number, maxTotalBytesPerEntry: number) => Promise<void>
  isUploadingAttachment: boolean
  uploadError: string | null

  deleteAttachment: (attachmentId: string) => Promise<void>
  deletingAttachmentId: string | null
  deleteError: string | null

  downloadAttachment: (attachment: PedagogicalLogAttachment) => Promise<void>
  downloadingAttachmentId: string | null
  downloadError: string | null
}

export function useLogEntryAttachments(logId: string): UseLogEntryAttachmentsResult {
  const [attachments, setAttachments] = useState<PedagogicalLogAttachment[] | null>(null)
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAttachments = useCallback(async () => {
    setIsLoadingAttachments(true)
    setLoadError(null)
    try {
      const fetched = await fetchLogAttachments(logId)
      setAttachments(fetched)
    } catch (caughtError) {
      setLoadError(getAttachmentLoadErrorMessage(caughtError))
    } finally {
      setIsLoadingAttachments(false)
    }
  }, [logId])

  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadAttachment = useCallback(
    async (file: File, maxFileBytes: number, maxTotalBytesPerEntry: number) => {
      setUploadError(null)

      // Refus local immédiat, avant même d'appeler le serveur — même logique
      // que `useNewLogEntryForm.onSelectAttachment` pour une entrée pas
      // encore créée.
      if (isAvatarFileTooLarge(file, maxFileBytes)) {
        setUploadError(getAttachmentTooLargeMessage(file.size, maxFileBytes))
        return
      }

      setIsUploadingAttachment(true)
      try {
        const uploaded = await uploadLogAttachment(logId, file)
        setAttachments((current) => [...(current ?? []), uploaded])
      } catch (caughtError) {
        setUploadError(
          getAttachmentUploadErrorMessage(caughtError, {
            maxFileBytes,
            maxTotalBytesPerEntry,
            attemptedFileSizeBytes: file.size,
          }),
        )
      } finally {
        setIsUploadingAttachment(false)
      }
    },
    [logId],
  )

  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const deleteAttachment = useCallback(
    async (attachmentId: string) => {
      setDeletingAttachmentId(attachmentId)
      setDeleteError(null)
      try {
        await deleteLogAttachment(logId, attachmentId)
        setAttachments((current) => (current ?? []).filter((item) => item.id !== attachmentId))
      } catch (caughtError) {
        setDeleteError(getAttachmentDeleteErrorMessage(caughtError))
      } finally {
        setDeletingAttachmentId(null)
      }
    },
    [logId],
  )

  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const downloadAttachment = useCallback(
    async (attachment: PedagogicalLogAttachment) => {
      setDownloadingAttachmentId(attachment.id)
      setDownloadError(null)
      try {
        const blobData = await fetchLogAttachmentBlob(logId, attachment.id)
        const blobUrl = URL.createObjectURL(blobData)
        const anchor = document.createElement('a')
        anchor.href = blobUrl
        anchor.download = attachment.originalFilename
        anchor.click()
        URL.revokeObjectURL(blobUrl)
      } catch (caughtError) {
        setDownloadError(getAttachmentDownloadErrorMessage(caughtError))
      } finally {
        setDownloadingAttachmentId(null)
      }
    },
    [logId],
  )

  return {
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
  }
}
