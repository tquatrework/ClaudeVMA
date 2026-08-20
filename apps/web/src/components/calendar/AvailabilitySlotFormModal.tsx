import React, { useMemo, useState } from 'react'
import type {
  AvailabilityKind,
  AvailabilityRecurrence,
  AvailabilitySlot,
  CreateAvailabilitySlotPayload,
} from '../../types/calendar'
import { AVAILABILITY_DAY_OPTIONS, getDayLabel } from '../../utils/availabilityDays'
import { isStartBeforeEnd, isValidTimeString } from '../../utils/availabilityTime'
import { buildIsoDateTimeForDay, isResolvedDateTimeInPast } from '../../utils/availabilitySlotApiMapping'

const KIND_OPTIONS: { value: AvailabilityKind; label: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'UNAVAILABLE', label: 'Indisponible' },
]

const RECURRENCE_OPTIONS: { value: AvailabilityRecurrence; label: string }[] = [
  { value: 'NONE', label: 'Une seule fois' },
  { value: 'WEEKLY', label: 'Chaque semaine' },
  { value: 'BIWEEKLY', label: 'Une semaine sur deux' },
]

export interface AvailabilitySlotFormInitialValues {
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: AvailabilityKind
  recurrence: AvailabilityRecurrence
  recurrenceEndDate: string | null
}

interface AvailabilitySlotFormModalProps {
  /** Présent en édition, absent en création. */
  editingSlot?: AvailabilitySlot
  initialValues: AvailabilitySlotFormInitialValues
  isSaving: boolean
  errorMessage: string | null
  onSubmit: (payload: CreateAvailabilitySlotPayload) => void
  onDelete?: () => void
  onClose: () => void
}

/**
 * AvailabilitySlotFormModal — sert la création, la modification et la suppression d'un même
 * créneau (dialog accessible, focus, bouton fermer).
 */
export default function AvailabilitySlotFormModal({
  editingSlot,
  initialValues,
  isSaving,
  errorMessage,
  onSubmit,
  onDelete,
  onClose,
}: AvailabilitySlotFormModalProps) {
  const isEditMode = editingSlot !== undefined

  const [dayOfWeek, setDayOfWeek] = useState(initialValues.dayOfWeek)
  const [startTime, setStartTime] = useState(initialValues.startTime)
  const [endTime, setEndTime] = useState(initialValues.endTime)
  const [kind, setKind] = useState<AvailabilityKind>(initialValues.kind)
  const [recurrence, setRecurrence] = useState<AvailabilityRecurrence>(
    initialValues.recurrence,
  )
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
    initialValues.recurrenceEndDate ?? '',
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const displayedError = validationError ?? errorMessage

  const areTimesValid =
    isValidTimeString(startTime) && isValidTimeString(endTime) && isStartBeforeEnd(startTime, endTime)

  /**
   * Avertissement de date déjà passée (décision utilisateur du 2026-08-19, même mécanisme que
   * `EventCreateFormModal`) — appliqué **uniquement en `recurrence: 'NONE'`** (« Une seule
   * fois ») : c'est le seul cas où la date résolue représente une occurrence concrète et unique,
   * exactement comme un événement créé sur la grille. Un créneau `WEEKLY`/
   * `BIWEEKLY` reste valide pour les semaines suivantes même si l'occurrence d'aujourd'hui est
   * déjà dépassée : avertir dans ce cas induirait en erreur sur l'utilité réelle du créneau.
   */
  const isResolvedDatePast = useMemo(() => {
    if (recurrence !== 'NONE') return false
    if (!isValidTimeString(startTime)) return false
    try {
      return isResolvedDateTimeInPast(buildIsoDateTimeForDay(dayOfWeek, startTime))
    } catch {
      return false
    }
  }, [recurrence, dayOfWeek, startTime])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
      setValidationError('Heures invalides.')
      return
    }
    if (!isStartBeforeEnd(startTime, endTime)) {
      setValidationError("L'heure de fin doit être après l'heure de début.")
      return
    }
    setValidationError(null)

    const payload: CreateAvailabilitySlotPayload = {
      dayOfWeek,
      startTime,
      endTime,
      kind,
      recurrence,
      recurrenceEndDate: recurrence === 'NONE' ? null : recurrenceEndDate || null,
    }
    onSubmit(payload)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? 'Modifier le créneau' : 'Nouveau créneau'}
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Modifier le créneau' : 'Nouveau créneau'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {displayedError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {displayedError}
          </div>
        )}

        {isResolvedDatePast && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            La date la plus proche pour « {getDayLabel(dayOfWeek).toLowerCase()} » est déjà
            passée. Vous pouvez tout de même créer ce créneau si vous le souhaitez.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="availability-slot-day" className="block text-sm font-medium text-gray-700 mb-1">
              Jour <span className="text-red-500">*</span>
            </label>
            <select
              id="availability-slot-day"
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(Number(event.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {AVAILABILITY_DAY_OPTIONS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="availability-slot-start" className="block text-sm font-medium text-gray-700 mb-1">
                Début <span className="text-red-500">*</span>
              </label>
              <input
                id="availability-slot-start"
                type="time"
                required
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label htmlFor="availability-slot-end" className="block text-sm font-medium text-gray-700 mb-1">
                Fin <span className="text-red-500">*</span>
              </label>
              <input
                id="availability-slot-end"
                type="time"
                required
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          <div>
            <label htmlFor="availability-slot-kind" className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="availability-slot-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AvailabilityKind)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="availability-slot-recurrence" className="block text-sm font-medium text-gray-700 mb-1">
              Récurrence
            </label>
            <select
              id="availability-slot-recurrence"
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as AvailabilityRecurrence)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {recurrence !== 'NONE' && (
            <div>
              <label
                htmlFor="availability-slot-recurrence-end"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Date de fin de récurrence (optionnel)
              </label>
              <input
                id="availability-slot-recurrence-end"
                type="date"
                value={recurrenceEndDate}
                onChange={(event) => setRecurrenceEndDate(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving || !areTimesValid}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement…' : isEditMode ? 'Enregistrer' : 'Créer'}
            </button>
            {isEditMode && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="bg-red-50 text-red-700 px-5 py-2 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
