import React, { useState } from 'react'
import { ReminderDelay } from './calendarTypes'
import { useReminderSettings } from '../../hooks/calendar/useReminderSettings'

const REMINDER_DELAY_LABELS: Record<ReminderDelay, string> = {
  '1week': '1 semaine avant',
  '1day': '1 jour avant',
  '1hour': '1 heure avant',
  '15min': '15 minutes avant',
  none: 'Aucun rappel',
}

interface ReminderSettingsPanelProps {
  eventId: string
}

export default function ReminderSettingsPanel({ eventId }: ReminderSettingsPanelProps) {
  const [selectedDelay, setSelectedDelay] = useState<ReminderDelay>('1day')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { isSaving, save } = useReminderSettings(eventId)

  const handleSave = async () => {
    setSuccessMessage(null)
    setErrorMessage(null)

    const succeeded = await save(selectedDelay)
    if (succeeded) {
      setSuccessMessage(
        selectedDelay === 'none'
          ? 'Rappel supprimé.'
          : `Rappel configuré : ${REMINDER_DELAY_LABELS[selectedDelay]}`,
      )
    } else {
      setErrorMessage('Impossible de configurer le rappel.')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={selectedDelay}
        onChange={(e) => {
          setSelectedDelay(e.target.value as ReminderDelay)
          setSuccessMessage(null)
          setErrorMessage(null)
        }}
        aria-label="Délai de rappel"
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {(Object.entries(REMINDER_DELAY_LABELS) as [ReminderDelay, string][]).map(
          ([delayValue, delayLabel]) => (
            <option key={delayValue} value={delayValue}>
              {delayLabel}
            </option>
          ),
        )}
      </select>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSaving ? 'Enregistrement…' : 'Enregistrer le rappel'}
      </button>

      {successMessage && (
        <span className="text-xs text-green-700">{successMessage}</span>
      )}
      {errorMessage && (
        <span className="text-xs text-red-700">{errorMessage}</span>
      )}
    </div>
  )
}
