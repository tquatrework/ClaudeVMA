/**
 * useNewLogEntryForm — état et soumission du formulaire de nouvelle entrée du
 * cahier de texte. Extrait de `PedagogicalLogPage` (chantier « Liens et pièces
 * jointes », 2026-08-26) pour rester sous le seuil de 300 lignes par fichier.
 *
 * Valide les liens (`resourceLinks`) côté front avant tout appel réseau —
 * mêmes règles que le serveur (label requis, URL absolue, 10 liens max).
 */

import { useState, type FormEvent } from 'react'
import type { LogEntryPayload, LogVisibility, ResourceLink } from '../../api/pedagogicalLog'
import { todayIsoCalendarDate } from '../../utils/dateFormat'
import { toSubmittableResourceLinks, validateResourceLinks } from '../../utils/resourceLinks'

export interface UseNewLogEntryFormResult {
  isNewEntryFormOpen: boolean
  openForm: () => void

  date: string
  onDateChange: (value: string) => void
  sessionSummary: string
  onSessionSummaryChange: (value: string) => void
  homework: string
  onHomeworkChange: (value: string) => void
  resourceLinks: ResourceLink[]
  onResourceLinksChange: (links: ResourceLink[]) => void
  visibility: LogVisibility
  onVisibilityChange: (value: LogVisibility) => void

  validationError: string | null
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
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([])
  const [visibility, setVisibility] = useState<LogVisibility>('eleve_parent_formateur')
  const [validationError, setValidationError] = useState<string | null>(null)

  const resetFields = () => {
    setSessionSummary('')
    setHomework('')
    setDate(todayIsoCalendarDate())
    setResourceLinks([])
    setValidationError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const error = validateResourceLinks(resourceLinks)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)

    const submittableResourceLinks = toSubmittableResourceLinks(resourceLinks)
    void createEntry({
      date: date || undefined,
      sessionSummary: sessionSummary.trim() || undefined,
      homework: homework.trim() || undefined,
      visibility,
      resourceLinks: submittableResourceLinks.length > 0 ? submittableResourceLinks : undefined,
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
    resourceLinks,
    onResourceLinksChange: setResourceLinks,
    visibility,
    onVisibilityChange: setVisibility,

    validationError,
    handleSubmit,
    handleCancel,
  }
}
