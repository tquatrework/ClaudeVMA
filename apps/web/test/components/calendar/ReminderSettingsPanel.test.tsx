import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/client')
import apiClient from '../../../src/api/client'

import ReminderSettingsPanel from '../../../src/components/calendar/ReminderSettingsPanel'

const mockApiClient = vi.mocked(apiClient)

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
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    render(<ReminderSettingsPanel eventId="evt-reminder-2" />)

    await userEvent.selectOptions(screen.getByLabelText('Délai de rappel'), '1hour')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/events/evt-reminder-2/reminders', {
        delay: '1hour',
      })
    })
  })

  it('affiche un message de succès après une réponse positive de l\'API', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    render(<ReminderSettingsPanel eventId="evt-reminder-3" />)

    await userEvent.click(screen.getByRole('button', { name: /enregistrer le rappel/i }))

    await waitFor(() => {
      expect(screen.getByText(/rappel configuré/i)).toBeDefined()
    })
  })
})
