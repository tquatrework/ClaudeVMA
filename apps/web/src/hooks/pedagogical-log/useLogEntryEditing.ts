/**
 * useLogEntryEditing — édition inline d'une entrée du cahier de texte.
 * Extrait de `PedagogicalLogPage` (chantier « Liens et pièces jointes »,
 * 2026-08-26) pour rester sous le seuil de 300 lignes par fichier.
 *
 * Réservée au formateur auteur pour une entrée normale (le mécanisme des
 * pages spéciales RP, avec son champ `content` libre, reste inchangé).
 */

import { useState } from 'react'
import type { LogEntryPayload, PedagogicalLogPage as LogPage, ResourceLink } from '../../api/pedagogicalLog'
import { toSubmittableResourceLinks, validateResourceLinks } from '../../utils/resourceLinks'
import type { LogEntryEditValues } from '../../components/pedagogical-log/PedagogicalLogEntryItem'

const EMPTY_EDIT_VALUES: LogEntryEditValues = {
  date: '',
  sessionSummary: '',
  homework: '',
  resourceLinks: [],
}

export interface UseLogEntryEditingResult {
  editingLogId: string | null
  editValues: LogEntryEditValues
  onEditValuesChange: (values: LogEntryEditValues) => void
  editContent: string
  onEditContentChange: (value: string) => void
  editValidationError: string | null
  startEdit: (entry: LogPage) => void
  cancelEdit: () => void
  saveEdit: (entry: LogPage) => void
}

export function useLogEntryEditing(
  updateEntry: (logId: string, payload: LogEntryPayload) => Promise<boolean>,
): UseLogEntryEditingResult {
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<LogEntryEditValues>(EMPTY_EDIT_VALUES)
  const [editContent, setEditContent] = useState('')
  const [editValidationError, setEditValidationError] = useState<string | null>(null)

  const startEdit = (entry: LogPage) => {
    setEditingLogId(entry.id)
    setEditValidationError(null)
    if (entry.isSpecialPage) {
      setEditContent(entry.content ?? '')
    } else {
      setEditValues({
        date: entry.date ?? '',
        sessionSummary: entry.sessionSummary ?? '',
        homework: entry.homework ?? '',
        resourceLinks: entry.resourceLinks ?? [],
      })
    }
  }

  const cancelEdit = () => {
    setEditingLogId(null)
    setEditValues(EMPTY_EDIT_VALUES)
    setEditContent('')
    setEditValidationError(null)
  }

  const saveEdit = (entry: LogPage) => {
    if (entry.isSpecialPage) {
      void updateEntry(entry.id, { content: editContent.trim() }).then((success) => {
        if (success) cancelEdit()
      })
      return
    }

    const validationError = validateResourceLinks(editValues.resourceLinks)
    if (validationError) {
      setEditValidationError(validationError)
      return
    }
    setEditValidationError(null)

    const submittableResourceLinks: ResourceLink[] = toSubmittableResourceLinks(editValues.resourceLinks)
    void updateEntry(entry.id, {
      date: editValues.date || undefined,
      sessionSummary: editValues.sessionSummary.trim() || undefined,
      homework: editValues.homework.trim() || undefined,
      resourceLinks: submittableResourceLinks,
    }).then((success) => {
      if (success) cancelEdit()
    })
  }

  return {
    editingLogId,
    editValues,
    onEditValuesChange: setEditValues,
    editContent,
    onEditContentChange: setEditContent,
    editValidationError,
    startEdit,
    cancelEdit,
    saveEdit,
  }
}
