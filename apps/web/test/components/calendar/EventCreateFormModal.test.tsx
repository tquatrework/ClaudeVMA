/**
 * EventCreateFormModal — remplace `QuickEventCreatePopover` (correction du 2026-08-20, point D) :
 * type/titre (réellement optionnel)/description/début-fin ajustables/destinataires choisis par
 * nom, avec prévisualisation busy/free.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/profile')

import { createOwnerEvent, fetchLinkedCalendarBusyFree } from '../../../src/api/calendar'
import { fetchMyContacts } from '../../../src/api/relations'
import { fetchValidatedTeachers } from '../../../src/api/profile'
import EventCreateFormModal from '../../../src/components/calendar/EventCreateFormModal'

const mockCreateOwnerEvent = vi.mocked(createOwnerEvent)
const mockFetchLinkedCalendarBusyFree = vi.mocked(fetchLinkedCalendarBusyFree)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)
const mockFetchValidatedTeachers = vi.mocked(fetchValidatedTeachers)

const DEFAULT_START = '2026-09-07T09:00:00.000Z'
const DEFAULT_END = '2026-09-07T10:00:00.000Z'

function renderModal(overrides: Partial<React.ComponentProps<typeof EventCreateFormModal>> = {}) {
  return render(
    <EventCreateFormModal
      ownerId="owner-1"
      userRole="formateur"
      defaultStartAt={DEFAULT_START}
      defaultEndAt={DEFAULT_END}
      weekFrom="2026-09-07T00:00:00.000Z"
      weekTo="2026-09-14T00:00:00.000Z"
      onCreated={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchMyContacts.mockResolvedValue([])
  mockFetchValidatedTeachers.mockResolvedValue({ data: [], page: 1, limit: 100, total: 0, totalPages: 0 })
})

describe('EventCreateFormModal — champs pré-remplis depuis la sélection sur la grille', () => {
  it('pré-remplit début/fin, ajustables (datetime-local, step quart d\'heure)', () => {
    renderModal()

    const startInput = screen.getByLabelText(/^début/i) as HTMLInputElement
    const endInput = screen.getByLabelText(/^fin/i) as HTMLInputElement

    expect(startInput.value).toBe('2026-09-07T09:00')
    expect(endInput.value).toBe('2026-09-07T10:00')
    expect(startInput.step).toBe('900')
    expect(endInput.step).toBe('900')
  })

  it('affiche un message et aucun champ si le rôle ne permet aucun type d\'événement', () => {
    renderModal({ userRole: 'parent_financeur' })

    expect(screen.getByText(/ne permet pas de créer/i)).toBeDefined()
    expect(screen.queryByLabelText(/^début/i)).toBeNull()
  })
})

describe('EventCreateFormModal — titre réellement optionnel', () => {
  it('crée un événement sans titre : le champ est omis du payload, jamais un texte de repli fabriqué', async () => {
    mockCreateOwnerEvent.mockResolvedValue({
      id: 'evt-1',
      startAt: DEFAULT_START,
      endAt: DEFAULT_END,
      eventType: 'cours',
    })
    const onCreated = vi.fn()

    renderModal({ onCreated })

    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    await waitFor(() => {
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ startAt: DEFAULT_START, endAt: DEFAULT_END }),
      )
    })
    const payload = mockCreateOwnerEvent.mock.calls[0][1]
    expect(payload).not.toHaveProperty('title')
    expect(onCreated).toHaveBeenCalled()
  })

  it('envoie le titre saisi quand il est fourni', async () => {
    mockCreateOwnerEvent.mockResolvedValue({
      id: 'evt-2',
      title: 'Cours de trigonométrie',
      startAt: DEFAULT_START,
      endAt: DEFAULT_END,
      eventType: 'cours',
    })

    renderModal()

    await userEvent.type(screen.getByLabelText(/titre/i), 'Cours de trigonométrie')
    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    await waitFor(() => {
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ title: 'Cours de trigonométrie' }),
      )
    })
  })
})

describe('EventCreateFormModal — validation', () => {
  it('refuse une fin antérieure ou égale au début', () => {
    renderModal()

    // `userEvent.type` ne fonctionne pas fiablement sur `datetime-local` en jsdom — même
    // technique que `ProposeCourseSlotDialog.test.tsx` (setter natif + événement `change`).
    const endInput = screen.getByLabelText(/^fin/i) as HTMLInputElement
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      '2026-09-07T08:00',
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    expect(screen.getByRole('button', { name: /^créer$/i })).toBeDisabled()
  })
})

describe('EventCreateFormModal — destinataires choisis par nom (point D)', () => {
  it('recherche, sélectionne un destinataire et l\'envoie dans inviteeIds, sans jamais afficher son UUID', async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-clara',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
    ])
    mockFetchLinkedCalendarBusyFree.mockResolvedValue({
      ownerId: 'student-clara',
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-09-14T00:00:00.000Z',
      availableWindows: [],
      unavailableBlocks: [],
      busyBlocks: [],
    })
    mockCreateOwnerEvent.mockResolvedValue({
      id: 'evt-3',
      startAt: DEFAULT_START,
      endAt: DEFAULT_END,
      eventType: 'cours',
    })

    renderModal()

    await userEvent.type(screen.getByLabelText(/destinataires/i), 'Clara')
    await waitFor(() => screen.getByRole('button', { name: 'Clara Petit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clara Petit' }))

    // Un chip nommé apparaît, jamais l'identifiant technique.
    expect(screen.queryByText('student-clara')).toBeNull()
    expect(screen.getByText(/disponibilités de clara petit/i)).toBeDefined()

    await waitFor(() => {
      expect(mockFetchLinkedCalendarBusyFree).toHaveBeenCalledWith(
        'student-clara',
        '2026-09-07T00:00:00.000Z',
        '2026-09-14T00:00:00.000Z',
      )
    })

    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    await waitFor(() => {
      expect(mockCreateOwnerEvent).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({ inviteeIds: ['student-clara'] }),
      )
    })
  })

  it('retire un destinataire sélectionné via son chip', async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-clara',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
    ])
    mockFetchLinkedCalendarBusyFree.mockResolvedValue({
      ownerId: 'student-clara',
      from: '2026-09-07T00:00:00.000Z',
      to: '2026-09-14T00:00:00.000Z',
      availableWindows: [],
      unavailableBlocks: [],
      busyBlocks: [],
    })

    renderModal()

    await userEvent.type(screen.getByLabelText(/destinataires/i), 'Clara')
    await waitFor(() => screen.getByRole('button', { name: 'Clara Petit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clara Petit' }))

    const chip = screen.getByRole('button', { name: /retirer clara petit/i })
    await userEvent.click(chip)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /retirer clara petit/i })).toBeNull()
    })
  })
})
