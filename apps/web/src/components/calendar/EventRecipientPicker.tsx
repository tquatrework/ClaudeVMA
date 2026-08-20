import React, { useMemo, useState } from 'react'
import { useEventRecipients } from '../../hooks/calendar/useEventRecipients'
import { ErrorMessage } from '../ui/ErrorMessage'
import LinkedCalendarView from './LinkedCalendarView'

interface EventRecipientPickerProps {
  userRole: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  /** Bornes ISO de la semaine affichée par le calendrier — pour la prévisualisation busy/free. */
  weekFrom: string
  weekTo: string
}

/**
 * EventRecipientPicker — champ de recherche par nom pour les destinataires (`inviteeIds`) d'un
 * événement (correction du 2026-08-20, point D). Jamais d'UUID saisi ni affiché (arbitrage du
 * 2026-08-09) : les personnes proposées viennent de `useEventRecipients` (contacts déjà liés à
 * l'utilisateur courant selon son rôle).
 *
 * Pendant la sélection, les disponibilités busy/free de la semaine du dernier destinataire choisi
 * s'affichent via `LinkedCalendarView` — déjà construit et intégré à `ProposeCourseSlotDialog`,
 * réutilisé ici tel quel plutôt que réécrit.
 */
export default function EventRecipientPicker({
  userRole,
  selectedIds,
  onChange,
  weekFrom,
  weekTo,
}: EventRecipientPickerProps) {
  const { recipients, isLoading, loadError } = useEventRecipients(userRole)
  const [searchTerm, setSearchTerm] = useState('')
  const [previewUserId, setPreviewUserId] = useState<string | null>(null)

  const selectedRecipients = useMemo(
    () => recipients.filter((recipient) => selectedIds.includes(recipient.userId)),
    [recipients, selectedIds],
  )

  const filteredCandidates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return recipients
      .filter((recipient) => !selectedIds.includes(recipient.userId))
      .filter((recipient) => recipient.displayName.toLowerCase().includes(normalizedSearch))
  }, [recipients, selectedIds, searchTerm])

  const addRecipient = (userId: string) => {
    onChange([...selectedIds, userId])
    setPreviewUserId(userId)
    setSearchTerm('')
  }

  const removeRecipient = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId))
    if (previewUserId === userId) setPreviewUserId(null)
  }

  return (
    <div>
      <label htmlFor="event-recipient-search" className="block text-sm font-medium text-gray-700 mb-1">
        Destinataires (optionnel)
      </label>

      {selectedRecipients.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {selectedRecipients.map((recipient) => (
            <li key={recipient.userId}>
              <button
                type="button"
                onClick={() => removeRecipient(recipient.userId)}
                onFocus={() => setPreviewUserId(recipient.userId)}
                className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full hover:bg-indigo-100"
              >
                {recipient.displayName}
                <span aria-hidden="true">✕</span>
                <span className="sr-only">Retirer {recipient.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        id="event-recipient-search"
        type="text"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder={isLoading ? 'Chargement…' : 'Rechercher un nom…'}
        disabled={isLoading}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
      />

      {loadError && <ErrorMessage message={loadError} className="mt-2" />}

      {!isLoading && !loadError && filteredCandidates.length > 0 && (
        <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
          {filteredCandidates.map((candidate) => (
            <li key={candidate.userId}>
              <button
                type="button"
                onClick={() => addRecipient(candidate.userId)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-indigo-50"
              >
                {candidate.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !loadError && recipients.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">Aucun destinataire disponible pour l'instant.</p>
      )}

      {previewUserId && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Disponibilités de{' '}
            {recipients.find((recipient) => recipient.userId === previewUserId)?.displayName}
          </p>
          <LinkedCalendarView ownerId={previewUserId} from={weekFrom} to={weekTo} />
        </div>
      )}
    </div>
  )
}
