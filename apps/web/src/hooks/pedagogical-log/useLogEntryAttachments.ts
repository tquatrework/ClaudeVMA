/**
 * useLogEntryAttachments — pièces jointes d'une entrée de cahier de texte.
 *
 * Chargement **à la demande** (pas au montage) : une entrée de cahier de texte
 * peut être ancienne et jamais consultée pour ses pièces jointes — appeler
 * `GET /logs/:id/attachments` pour chaque entrée affichée exigerait autant de
 * requêtes que d'entrées visibles, pour une information que le lecteur n'a pas
 * forcément demandée. `loadAttachments` est donc déclenché explicitement par
 * la page/le composant (ex. au premier dépliage du bloc « Pièces jointes »).
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
import { isAvatarFileTooLarge } from '../../utils/profileAvatarConstraints'
import {
  getAttachmentDeleteErrorMessage,
  getAttachmentDownloadErrorMessage,
  getAttachmentLoadErrorMessage,
  getAttachmentTooLargeMessage,
  getAttachmentUploadErrorMessage,
} from '../../utils/logAttachment'

export interface UseLogEntryAttachmentsResult {
  attachments: PedagogicalLogAttachment[] | null
  isLoadingAttachments: boolean
  loadError: string | null
  loadAttachments: () => Promise<void>

  uploadAttachment: (file: File, maxFileBytes: number, maxTotalBytesPerEntry: number) => Promise<boolean>
  isUploadingAttachment: boolean
  uploadError: string | null
  dismissUploadError: () => void

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
    async (file: File, maxFileBytes: number, maxTotalBytesPerEntry: number): Promise<boolean> => {
      setUploadError(null)

      // Refus local : le fichier ne part pas si le plafond par fichier est
      // déjà dépassable localement — même raisonnement que l'avatar.
      if (isAvatarFileTooLarge(file, maxFileBytes)) {
        setUploadError(getAttachmentTooLargeMessage(file.size, maxFileBytes))
        return false
      }

      setIsUploadingAttachment(true)
      try {
        const created = await uploadLogAttachment(logId, file)
        setAttachments((current) => [...(current ?? []), created])
        return true
      } catch (caughtError) {
        setUploadError(
          getAttachmentUploadErrorMessage(caughtError, {
            maxFileBytes,
            maxTotalBytesPerEntry,
            attemptedFileSizeBytes: file.size,
          }),
        )
        return false
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
    dismissUploadError: () => setUploadError(null),

    deleteAttachment,
    deletingAttachmentId,
    deleteError,

    downloadAttachment,
    downloadingAttachmentId,
    downloadError,
  }
}
