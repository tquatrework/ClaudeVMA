/**
 * useLogEntryAttachments — pièces jointes d'une entrée de cahier de texte
 * déjà créée : chargement, téléchargement et suppression.
 *
 * L'ajout n'en fait plus partie depuis le 2026-08-27 (décision explicite de
 * l'utilisateur) : une pièce jointe ne se joint plus qu'au moment de la
 * création d'une entrée (`useNewLogEntryForm`, qui appelle `uploadLogAttachment`
 * directement, indépendamment de ce hook).
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
  type PedagogicalLogAttachment,
} from '../../api/pedagogicalLogAttachments'
import {
  getAttachmentDeleteErrorMessage,
  getAttachmentDownloadErrorMessage,
  getAttachmentLoadErrorMessage,
} from '../../utils/logAttachment'

export interface UseLogEntryAttachmentsResult {
  attachments: PedagogicalLogAttachment[] | null
  isLoadingAttachments: boolean
  loadError: string | null
  loadAttachments: () => Promise<void>

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

    deleteAttachment,
    deletingAttachmentId,
    deleteError,

    downloadAttachment,
    downloadingAttachmentId,
    downloadError,
  }
}
