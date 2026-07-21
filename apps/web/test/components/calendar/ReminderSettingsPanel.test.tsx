import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
import { setEventReminder } from '../../../src/api/calendar'

import ReminderSettingsPanel from '../../../src/components/calendar/ReminderSettingsPanel'

const mockSetEventReminder = vi.mocked(setEventReminder)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReminderSettingsPanel', () => {
  it('rend le select avec toutes les options de délai disponibles', () => {
    render(<ReminderSettingsPanel eventId="evt-reminder-1" />)

    const selectElement = screen.getByLabelText('Délai de rappel')
    expect(selectElement).toBeDefined()

    const options = Array.from(selectElement.querySelectorAll('option'))
    const optionValues = options.map((opt) => opt.getAttribute('value'))

    expect(optionValues).toContain('1week')
    expect(optionValues).toContain('1day')
    expect(optionValues).toContain('1hour')
    expect(optionValues).toContain('15min')
    expect(optionValues).toContain('none')
    expect(options).toHaveLength(5)

    expect(screen.getByRole('button', { name: /enregistrer le rappel/i })).toBeDefined()
  })

  it('appelle POST /events/:id/reminders avec le bon delay à la soumission', async () => {
    mockSetEventReminder.mockResolvedValue(undefined)

    render(<ReminderSettingsPanel eventId="evt-reminder-2" />)

    await userEvent.selectOptions(screen.getByLabelText('Délai de rappel'), '1hour')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(mockSetEventReminder).toHaveBeenCalledWith('evt-reminder-2', '1hour')
    })
  })

  it('affiche un message de succès après une réponse positive de l\'API', async () => {
    mockSetEventReminder.mockResolvedValue(undefined)

    render(<ReminderSettingsPanel eventId="evt-reminder-3" />)

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(screen.getByText(/rappel configuré/i)).toBeDefined()
    })
  })

  it('affiche un message d\'erreur si la configuration échoue', async () => {
    mockSetEventReminder.mockRejectedValue(new Error('network down'))

    render(<ReminderSettingsPanel eventId="evt-reminder-4" />)

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(screen.getByText('Impossible de configurer le rappel.')).toBeDefined()
    })
  })
})
