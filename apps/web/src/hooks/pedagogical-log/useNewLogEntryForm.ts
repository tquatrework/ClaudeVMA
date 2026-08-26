/**
 * useNewLogEntryForm — état et soumission du formulaire de nouvelle entrée du
 * cahier de texte. Extrait de `PedagogicalLogPage` (chantier « Liens et pièces
 * jointes », 2026-08-26) pour rester sous le seuil de 300 lignes par fichier.
 *
 * Les liens s'insèrent directement dans `sessionSummary`/`homework` via
 * `InsertLinkButton` (syntaxe légère `[texte](url)`, `src/utils/lightMarkup.ts`)
 * — il n'y a donc plus de champ ni de validation dédiés à un `resourceLinks`
 * structuré (retiré le 2026-08-26 après retour utilisateur réel).
 */

import { useState, type FormEvent } from 'react'
import type { LogEntryPayload, LogVisibility } from '../../api/pedagogicalLog'
import { todayIsoCalendarDate } from '../../utils/dateFormat'

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

  handleSubmit: (event: FormEvent) => void
  handleCancel: () => void
}

export function useNewLogEntryForm(
  createEntry: (payload: LogEntryPayload) => Promise<boolean>,
): UseNewLogEntryFormResult {
  const [isNewEntryFormOpen, setIsNewEntryFormOpen] = useState(false)
  const [date, setDate] = useState(todayIsoCalendarDate())
  const [sessionSummary, setSessionSummary] = useState('')
  const [homework, setHomework] = useState('')
  const [visibility, setVisibility] = useState<LogVisibility>('eleve_parent_formateur')

  const resetFields = () => {
    setSessionSummary('')
    setHomework('')
    setDate(todayIsoCalendarDate())
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    void createEntry({
      date: date || undefined,
      sessionSummary: sessionSummary.trim() || undefined,
      homework: homework.trim() || undefined,
      visibility,
    }).then((success) => {
      if (success) {
        resetFields()
        setIsNewEntryFormOpen(false)
      }
    })
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

    handleSubmit,
    handleCancel,
  }
}
