/**
 * ProposeCourseSlotDialog — couvre :
 * - Sélection du destinataire selon le rôle proposeur (formateur → élèves,
 *   animateur_pedagogique → formateurs animés, responsable_pedagogique → annuaire validé).
 * - Montage réel de `LinkedCalendarView` une fois le destinataire choisi (point de montage
 *   qui manquait depuis le point 2 du chantier calendrier de disponibilités).
 * - Soumission (`POST /activities`), erreur affichée proprement.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/calendar')
vi.mock('../../../src/api/relations')
vi.mock('../../../src/api/profile')

import { useAuth } from '../../../src/hooks/useAuth'
import { createActivity, fetchLinkedCalendarBusyFree } from '../../../src/api/calendar'
import { fetchMyContacts } from '../../../src/api/relations'
import { fetchValidatedTeachers } from '../../../src/api/profile'
import ProposeCourseSlotDialog from '../../../src/components/calendar/ProposeCourseSlotDialog'

const mockUseAuth = vi.mocked(useAuth)
const mockCreateActivity = vi.mocked(createActivity)
const mockFetchLinkedCalendarBusyFree = vi.mocked(fetchLinkedCalendarBusyFree)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)
const mockFetchValidatedTeachers = vi.mocked(fetchValidatedTeachers)

function buildAuthMock(userId: string) {
  return {
    user: { id: userId, email: 'user@test.com', role: 'formateur' as const, validationStatus: 'active' as const },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

const EMPTY_BUSY_FREE = {
  ownerId: 'x',
  from: '2026-09-10T00:00:00.000Z',
  to: '2026-09-17T00:00:00.000Z',
  availableWindows: [],
  unavailableBlocks: [],
  busyBlocks: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock('teacher-1'))
  mockFetchLinkedCalendarBusyFree.mockResolvedValue(EMPTY_BUSY_FREE)
  mockFetchMyContacts.mockResolvedValue([])
  mockFetchValidatedTeachers.mockResolvedValue({ data: [], page: 1, limit: 100, total: 0, totalPages: 0 })
})

describe('ProposeCourseSlotDialog — formateur → élève', () => {
  it("liste les élèves du formateur, jamais un autre contact", async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-1',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
      {
        userId: 'parent-1',
        firstName: 'Marc',
        lastName: 'Petit',
        relations: [{ kind: 'finance_owner_of_student_of_teacher', throughUserIds: ['student-1'] }],
      },
    ])

    render(
      <ProposeCourseSlotDialog proposerRole="formateur" onCreated={vi.fn()} onClose={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Clara Petit' })).toBeDefined()
    })
    expect(screen.queryByRole('option', { name: 'Marc Petit' })).toBeNull()
  })

  it('monte LinkedCalendarView une fois un élève sélectionné (busy/free réellement appelé)', async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-1',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
    ])

    render(
      <ProposeCourseSlotDialog proposerRole="formateur" onCreated={vi.fn()} onClose={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Clara Petit' })).toBeDefined()
    })

    await userEvent.selectOptions(
      screen.getByLabelText(/élève/i),
      'student-1',
    )

    await waitFor(() => {
      expect(mockFetchLinkedCalendarBusyFree).toHaveBeenCalledWith(
        'student-1',
        expect.any(String),
        expect.any(String),
      )
    })
    expect(screen.getByText(/calendrier en lecture seule/i)).toBeDefined()
  })

  it('soumet la proposition avec type "cours" et un seul participant', async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-1',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
    ])
    const onCreated = vi.fn()
    mockCreateActivity.mockResolvedValue({
      id: 'activity-1',
      type: 'cours',
      creatorId: 'teacher-1',
      creatorRole: 'formateur',
      participantIds: ['student-1'],
      startTime: '2030-06-20T10:00:00.000Z',
      endTime: '2030-06-20T11:00:00.000Z',
      status: 'proposed',
      createdAt: '2030-06-01T00:00:00.000Z',
      updatedAt: '2030-06-01T00:00:00.000Z',
    })

    render(
      <ProposeCourseSlotDialog proposerRole="formateur" onCreated={onCreated} onClose={vi.fn()} />,
    )

    await waitFor(() => screen.getByRole('option', { name: 'Clara Petit' }))
    await userEvent.selectOptions(screen.getByLabelText(/élève/i), 'student-1')

    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      startInput,
      '2030-06-20T10:00',
    )
    startInput.dispatchEvent(new Event('change', { bubbles: true }))
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      '2030-06-20T11:00',
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /proposer ce créneau/i }))

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cours', participantIds: ['student-1'] }),
      )
    })
    expect(onCreated).toHaveBeenCalled()
  })

  it("affiche un message générique en cas de 403 (lien absent), jamais de jargon technique", async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'student-1',
        firstName: 'Clara',
        lastName: 'Petit',
        relations: [{ kind: 'teacher_of_student' }],
      },
    ])
    mockCreateActivity.mockRejectedValue({ response: { status: 403 } })

    render(
      <ProposeCourseSlotDialog proposerRole="formateur" onCreated={vi.fn()} onClose={vi.fn()} />,
    )

    await waitFor(() => screen.getByRole('option', { name: 'Clara Petit' }))
    await userEvent.selectOptions(screen.getByLabelText(/élève/i), 'student-1')

    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      startInput,
      '2030-06-20T10:00',
    )
    startInput.dispatchEvent(new Event('change', { bubbles: true }))
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      endInput,
      '2030-06-20T11:00',
    )
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /proposer ce créneau/i }))

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas autorisé à effectuer cette action.")).toBeDefined()
    })
  })
})

describe('ProposeCourseSlotDialog — responsable_pedagogique → formateur', () => {
  it("utilise l'annuaire des formateurs validés, pas les contacts", async () => {
    mockFetchValidatedTeachers.mockResolvedValue({
      data: [{ userId: 'teacher-9', firstName: 'Hugo', lastName: 'Vidal', levels: null, subjects: null }],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    })

    render(
      <ProposeCourseSlotDialog
        proposerRole="responsable_pedagogique"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hugo Vidal' })).toBeDefined()
    })
    // Le RP choisit son destinataire dans l'annuaire des formateurs validés, jamais dans ses
    // contacts (my-contacts reste appelé par `useMyContacts`, non conditionnable côté hook,
    // mais son résultat n'alimente pas la liste affichée ici).
    expect(mockFetchValidatedTeachers).toHaveBeenCalled()
  })
})

describe('ProposeCourseSlotDialog — animateur_pedagogique → formateur animé', () => {
  it('ne liste que les formateurs animés', async () => {
    mockFetchMyContacts.mockResolvedValue([
      {
        userId: 'teacher-9',
        firstName: 'Hugo',
        lastName: 'Vidal',
        relations: [{ kind: 'animator_of_teacher' }],
      },
      {
        userId: 'teacher-other',
        firstName: 'Nadia',
        lastName: 'Lambert',
        relations: [{ kind: 'teacher_of_animator' }],
      },
    ])

    render(
      <ProposeCourseSlotDialog
        proposerRole="animateur_pedagogique"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hugo Vidal' })).toBeDefined()
    })
    expect(screen.queryByRole('option', { name: 'Nadia Lambert' })).toBeNull()
  })
})
