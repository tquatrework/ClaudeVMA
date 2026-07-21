import { useCallback, useState } from 'react'
import { setEventReminder } from '../../api/calendar'
import type { ReminderDelay } from '../../components/calendar/calendarTypes'

export interface UseReminderSettingsResult {
  isSaving: boolean
  save: (delay: ReminderDelay) => Promise<boolean>
}

/**
 * useReminderSettings — orchestration réseau de ReminderSettingsPanel : configure le délai de
 * rappel d'un événement. La composition des messages de succès/erreur reste dans le composant
 * (dépend des libellés affichés) — le hook ne fait que porter l'appel réseau et `isSaving`,
 * reproduisant le comportement préexistant sans changer le texte affiché.
 */
export function useReminderSettings(eventId: string): UseReminderSettingsResult {
  const [isSaving, setIsSaving] = useState(false)

  const save = useCallback(
    async (delay: ReminderDelay): Promise<boolean> => {
      setIsSaving(true)
      try {
        await setEventReminder(eventId, delay)
        return true
      } catch {
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [eventId],
  )

  return { isSaving, save }
}
