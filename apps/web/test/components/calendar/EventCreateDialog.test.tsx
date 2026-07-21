import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
import { createOwnerEvent } from '../../../src/api/calendar'

import EventCreateDialog from '../../../src/components/calendar/EventCreateDialog'
import type { CalendarEvent } from '../../../src/components/calendar/calendarTypes'

const mockCreateOwnerEvent = vi.mocked(createOwnerEvent)

const START_DATETIME = '2030-08-10T09:00'
const END_DATETIME = '2030-08-10T10:00'

function renderDialog(
  overrides: Partial<{
    ownerId: string
    userRole: string
    onCreated: (event: CalendarEvent) => void
    onClose: () => void
  }> = {},
) {
  return render(
    <EventCreateDialog
      ownerId={overrides.ownerId ?? 'owner-99'}
      userRole={overrides.userRole ?? 'formateur'}
      onCreated={overrides.onCreated ?? vi.fn()}
      onClose={overrides.onClose ?? vi.fn()}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EventCreateDialog', () => {
  it('rend le formulaire avec les champs Titre, Type, Début, Fin et Description', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: /créer un événement/i })).toBeDefined()
    expect(screen.getByText(/Titre/i)).toBeDefined()
    expect(screen.getByText(/Type/i)).toBeDefined()
    expect(screen.getByText(/Début/i)).toBeDefined()
    expect(screen.getByText(/Fin/i)).toBeDefined()
    expect(screen.getByText(/Description/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /créer/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /annuler/i })).toBeDefined()
  })

  it('affiche uniquement les types autorisés pour le rôle fourni', () => {
    renderDialog({ userRole: 'eleve' })

    const selectElement = screen.getByRole('combobox')
    const options = Array.from(selectElement.querySelectorAll('option'))
    const optionValues = options.map((opt) => opt.getAttribute('value'))

    expect(optionValues).toEqual(['rappel'])
    expect(optionValues).not.toContain('cours')
    expect(optionValues).not.toContain('masterclass')
  })

  it('appelle POST /calendars/:ownerId/events avec le bon body à la soumission', async () => {
    const createdEvent: CalendarEvent = {
      id: 'new-evt-1',
      title: 'Cours de maths',
      startAt: new Date(START_DATETIME).toISOString(),
      endAt: new Date(END_DATETIME).toISOString(),
      eventType: 'cours',
    }
    mockCreateOwnerEvent.mockResolvedValue(createdEvent)

    renderDialog({ ownerId: 'owner-99', userRole: 'formateur' })

    const titleInput = screen.getByPlaceholderText(/cours de mathématiques/i)
    await userEvent.type(titleInput, 'Cours de maths')

    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      startInput,
      START_DATETIME,
    )
    startInput.dispatchEvent(new Event('change', { bubbles: true }))

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      END_DATETIME,
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        'owner-99',
        expect.objectContaining({
          startAt: new Date(START_DATETIME).toISOString(),
          endAt: new Date(END_DATETIME).toISOString(),
          eventType: expect.any(String),
          title: 'Cours de maths',
        }),
      )
    })
  })

  it('appelle onCreated avec l\'événement créé après succès de l\'API', async () => {
    const handleCreated = vi.fn()
    const createdEvent: CalendarEvent = {
      id: 'new-evt-2',
      startAt: new Date(START_DATETIME).toISOString(),
      endAt: new Date(END_DATETIME).toISOString(),
      eventType: 'cours',
    }
    mockCreateOwnerEvent.mockResolvedValue(createdEvent)

    renderDialog({ ownerId: 'owner-99', userRole: 'formateur', onCreated: handleCreated })

    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      startInput,
      START_DATETIME,
    )
    startInput.dispatchEvent(new Event('change', { bubbles: true }))

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      END_DATETIME,
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(handleCreated).toHaveBeenCalledWith(createdEvent)
    })
  })
})
