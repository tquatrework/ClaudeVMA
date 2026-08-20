/**
 * ProposeCourseSlotDialog — propose un créneau de cours à un destinataire unique
 * (`POST /activities`, chantier calendrier de disponibilités, point 3). Libellé retenu côté
 * interface : « Proposer un créneau » — le verbe API reste inchangé (`POST /activities`, qui
 * naît à `status: "proposed"`).
 *
 * Le destinataire se choisit **par son nom**, jamais par un identifiant saisi :
 * - `formateur` → l'un de ses élèves (`teacher_of_student`, `useMyContacts`), `type: "cours"` ;
 * - `animateur_pedagogique` → l'un des formateurs qu'il anime (`animator_of_teacher`,
 *   `useMyContacts`), `type: "reunion_pedagogique"` ;
 * - `responsable_pedagogique` → n'importe quel formateur validé (`useSelectableTeachers`,
 *   `GET /profiles/teachers/validated`), `type: "reunion_pedagogique"`, sans restriction de
 *   lien côté serveur.
 *
 * Une fois le destinataire choisi, `LinkedCalendarView` (point 2 du chantier, jusqu'ici jamais
 * monté) affiche son calendrier busy/free de la semaine courante — le proposeur voit ses
 * disponibilités avant de choisir un horaire, sans jamais voir le contenu de son calendrier.
 */

import React, { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEventRecipients } from '../../hooks/calendar/useEventRecipients'
import { useProposeCourseSlot } from '../../hooks/calendar/useProposeCourseSlot'
import { getCurrentWeekWindow } from '../../utils/calendarWeekWindow'
import { getActivityTypeLabel } from '../../utils/activityLabels'
import type { ActivityType, ScheduledActivity } from '../../types/calendar'
import { ErrorMessage } from '../ui/ErrorMessage'
import LinkedCalendarView from './LinkedCalendarView'

export type CourseProposerRole = 'formateur' | 'animateur_pedagogique' | 'responsable_pedagogique'

interface ProposeCourseSlotDialogProps {
  proposerRole: CourseProposerRole
  onCreated: (activity: ScheduledActivity) => void
  onClose: () => void
}

function activityTypeForRole(proposerRole: CourseProposerRole): ActivityType {
  return proposerRole === 'formateur' ? 'cours' : 'reunion_pedagogique'
}

function recipientLabelForRole(proposerRole: CourseProposerRole): string {
  return proposerRole === 'formateur' ? 'Élève' : 'Professeur'
}

export default function ProposeCourseSlotDialog({
  proposerRole,
  onCreated,
  onClose,
}: ProposeCourseSlotDialogProps) {
  const { user } = useAuth()

  const {
    recipients,
    isLoading: isLoadingRecipients,
    loadError: recipientsLoadError,
  } = useEventRecipients(proposerRole)

  const activityType = activityTypeForRole(proposerRole)

  const [recipientId, setRecipientId] = useState('')
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const { isSubmitting, errorMessage, clearError, submit } = useProposeCourseSlot()
  const displayedError = validationError ?? errorMessage

  const weekWindow = useMemo(() => getCurrentWeekWindow(), [])
  const isEndAfterStart = !startAt || !endAt || new Date(endAt) > new Date(startAt)
  const canSubmit = recipientId.length > 0 && startAt.length > 0 && endAt.length > 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    if (!isEndAfterStart) {
      setValidationError('La fin doit être après le début.')
      return
    }
    setValidationError(null)

    const created = await submit({
      type: activityType,
      participantIds: [recipientId],
      startTime: new Date(startAt).toISOString(),
      endTime: new Date(endAt).toISOString(),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    })
    if (created) onCreated(created)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Proposer un créneau"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Proposer un créneau</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Type de créneau proposé : <strong>{getActivityTypeLabel(activityType)}</strong>
        </p>

        {displayedError && <ErrorMessage message={displayedError} onClose={clearError} className="mb-4" />}
        {recipientsLoadError && (
          <ErrorMessage message={recipientsLoadError} className="mb-4" />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="propose-slot-recipient" className="block text-sm font-medium text-gray-700 mb-1">
              {recipientLabelForRole(proposerRole)} <span className="text-red-500">*</span>
            </label>
            <select
              id="propose-slot-recipient"
              required
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              disabled={isSubmitting || isLoadingRecipients}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            >
              <option value="">
                {isLoadingRecipients ? 'Chargement…' : 'Choisir…'}
              </option>
              {recipients.map((recipient) => (
                <option key={recipient.userId} value={recipient.userId}>
                  {recipient.displayName}
                </option>
              ))}
            </select>
            {!isLoadingRecipients && recipients.length === 0 && !recipientsLoadError && (
              <p className="text-xs text-gray-400 mt-1">Aucun destinataire disponible pour l'instant.</p>
            )}
          </div>

          {recipientId && user && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Disponibilités de {recipients.find((recipient) => recipient.userId === recipientId)?.displayName}
              </p>
              <LinkedCalendarView ownerId={recipientId} from={weekWindow.from} to={weekWindow.to} />
            </div>
          )}

          <div>
            <label htmlFor="propose-slot-title" className="block text-sm font-medium text-gray-700 mb-1">
              Titre (optionnel)
            </label>
            <input
              id="propose-slot-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex : Cours de mathématiques"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="propose-slot-start" className="block text-sm font-medium text-gray-700 mb-1">
                Début <span className="text-red-500">*</span>
              </label>
              <input
                id="propose-slot-start"
                type="datetime-local"
                required
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="propose-slot-end" className="block text-sm font-medium text-gray-700 mb-1">
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                id="propose-slot-end"
                type="datetime-local"
                required
                value={endAt}
                min={startAt}
                onChange={(event) => setEndAt(event.target.value)}
                disabled={isSubmitting}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="propose-slot-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              id="propose-slot-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Précisions sur ce créneau…"
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit || !isEndAfterStart}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Envoi…' : 'Proposer ce créneau'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
