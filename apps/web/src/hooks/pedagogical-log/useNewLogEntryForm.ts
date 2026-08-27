/**
 * useNewLogEntryForm — état et soumission du formulaire de nouvelle entrée du
 * cahier de texte. Extrait de `PedagogicalLogPage` (chantier « Liens et pièces
 * jointes », 2026-08-26) pour rester sous le seuil de 300 lignes par fichier.
 *
 * Les liens s'insèrent directement dans `sessionSummary`/`homework` via
 * `InsertLinkButton` (syntaxe légère `[texte](url)`, `src/utils/lightMarkup.ts`)
 * — il n'y a donc plus de champ ni de validation dédiés à un `resourceLinks`
 * structuré (retiré le 2026-08-26 après retour utilisateur réel).
 *
 * Pièce jointe choisie pendant la saisie (2026-08-27, défaut majeur remonté
 * par test utilisateur). Contrainte serveur inchangée : `POST
 * /logs/:id/attachments` exige un `logEntryId` existant (l'entrée doit être
 * créée avant qu'un fichier puisse lui être rattaché) — mais rien n'oblige le
 * **front** à faire de cette contrainte une étape visible séparée pour
 * l'utilisateur. Le fichier choisi est donc gardé en état local
 * (`pendingAttachment`) pendant toute la saisie, avec une validation locale
 * immédiate du plafond (même logique que `useLogEntryAttachments`), puis
 * envoyé **juste après** la création de l'entrée, dans le même geste de
 * soumission (`handleSubmit`) — un seul clic sur « Ajouter une entrée ».
 *
 * Si l'entrée se crée mais que l'envoi du fichier échoue ensuite, l'entrée
 * n'est **jamais** recréée : elle existe déjà (visible dans la liste), seul
 * l'échec de la pièce jointe est signalé (`attachmentError`), pour que
 * l'utilisateur puisse rouvrir l'entrée créée et réessayer l'ajout depuis
 * `LogEntryAttachments`.
 */

import { useState, type FormEvent } from 'react'
import type { LogEntryPayload, LogVisibility, PedagogicalLogPage } from '../../api/pedagogicalLog'
import { uploadLogAttachment, type PedagogicalLogAttachmentSettings } from '../../api/pedagogicalLogAttachments'
import { todayIsoCalendarDate } from '../../utils/dateFormat'
import { formatFileSize } from '../../utils/fileSize'
import { getAttachmentTooLargeMessage, getAttachmentUploadErrorMessage } from '../../utils/logAttachment'
import { isAvatarFileTooLarge } from '../../utils/profileAvatarConstraints'

export interface UseNewLogEntryFormResult {
  isNewEntryFormOpen: boolean
  openForm: () => void

  date: string
  onDateChange: (value: string) => void
  sessionSummary: string
  onSessionSummaryChange: (value: string) => void
  homework: string
  onHomeworkChange: (value: string) => void
  visibility: LogVisibility
  onVisibilityChange: (value: LogVisibility) => void

  /** Création de l'entrée ET, le cas échéant, envoi de la pièce jointe — un seul indicateur pour l'utilisateur. */
  isSaving: boolean
  handleSubmit: (event: FormEvent) => void
  handleCancel: () => void

  /** Pièce jointe choisie pendant la saisie, envoyée après la création. */
  pendingAttachmentName: string | null
  pendingAttachmentSizeLabel: string | null
  attachmentError: string | null
  onSelectAttachment: (file: File | null) => void
  onRemoveAttachment: () => void
  dismissAttachmentError: () => void
}

export function useNewLogEntryForm(
  createEntry: (payload: LogEntryPayload) => Promise<PedagogicalLogPage | null>,
  isCreatingEntry: boolean,
  attachmentSettings: PedagogicalLogAttachmentSettings,
): UseNewLogEntryFormResult {
  const [isNewEntryFormOpen, setIsNewEntryFormOpen] = useState(false)
  const [date, setDate] = useState(todayIsoCalendarDate())
  const [sessionSummary, setSessionSummary] = useState('')
  const [homework, setHomework] = useState('')
  const [visibility, setVisibility] = useState<LogVisibility>('eleve_parent_formateur')

  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)

  // Réinitialise les champs texte de l'entrée, sans toucher à `attachmentError` :
  // après un échec d'envoi de pièce jointe, on ferme le formulaire (l'entrée
  // existe déjà) mais on garde le message d'erreur visible à l'écran.
  const resetEntryFields = () => {
    setSessionSummary('')
    setHomework('')
    setDate(todayIsoCalendarDate())
    setPendingAttachment(null)
  }

  const resetFields = () => {
    resetEntryFields()
    setAttachmentError(null)
  }

  const onSelectAttachment = (file: File | null) => {
    setAttachmentError(null)
    if (!file) {
      setPendingAttachment(null)
      return
    }
    // Refus local immédiat, avant même de créer l'entrée — même logique que
    // `useLogEntryAttachments.uploadAttachment` pour une entrée existante.
    if (isAvatarFileTooLarge(file, attachmentSettings.maxFileBytes)) {
      setAttachmentError(getAttachmentTooLargeMessage(file.size, attachmentSettings.maxFileBytes))
      setPendingAttachment(null)
      return
    }
    setPendingAttachment(file)
  }

  const onRemoveAttachment = () => {
    setPendingAttachment(null)
    setAttachmentError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    void (async () => {
      const created = await createEntry({
        date: date || undefined,
        sessionSummary: sessionSummary.trim() || undefined,
        homework: homework.trim() || undefined,
        visibility,
      })
      // Échec de création : rien à faire ici, `createError` (porté par la
      // page) l'affiche déjà, et le formulaire reste ouvert pour réessayer —
      // la pièce jointe choisie reste sélectionnée.
      if (!created) return

      const attachmentToUpload = pendingAttachment
      if (attachmentToUpload) {
        setIsUploadingAttachment(true)
        try {
          await uploadLogAttachment(created.id, attachmentToUpload)
        } catch (caughtError) {
          setAttachmentError(
            getAttachmentUploadErrorMessage(caughtError, {
              maxFileBytes: attachmentSettings.maxFileBytes,
              maxTotalBytesPerEntry: attachmentSettings.maxTotalBytesPerEntry,
              attemptedFileSizeBytes: attachmentToUpload.size,
            }),
          )
          setIsUploadingAttachment(false)
          // L'entrée existe déjà : on ne la recrée pas. On referme le
          // formulaire (elle est visible dans la liste) et on garde le
          // message d'erreur affiché au niveau de la page.
          resetEntryFields()
          setIsNewEntryFormOpen(false)
          return
        }
        setIsUploadingAttachment(false)
      }

      resetFields()
      setIsNewEntryFormOpen(false)
    })()
  }

  const handleCancel = () => {
    setIsNewEntryFormOpen(false)
    resetFields()
  }

  return {
    isNewEntryFormOpen,
    openForm: () => setIsNewEntryFormOpen(true),

    date,
    onDateChange: setDate,
    sessionSummary,
    onSessionSummaryChange: setSessionSummary,
    homework,
    onHomeworkChange: setHomework,
    visibility,
    onVisibilityChange: setVisibility,

    isSaving: isCreatingEntry || isUploadingAttachment,
    handleSubmit,
    handleCancel,

    pendingAttachmentName: pendingAttachment?.name ?? null,
    pendingAttachmentSizeLabel: pendingAttachment ? formatFileSize(pendingAttachment.size) : null,
    attachmentError,
    onSelectAttachment,
    onRemoveAttachment,
    dismissAttachmentError: () => setAttachmentError(null),
  }
}
