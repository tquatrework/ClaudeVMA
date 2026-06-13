/**
 * Tests for CalendarPage
 *
 * Covers:
 * - Displays activities from GET /calendar
 * - Loading and empty states
 * - API error is shown
 * - Create session form is shown only for authorised roles (formateur, RP…)
 * - POST /calendar is called with correct payload when form is submitted
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarPage from '../../src/pages/CalendarPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TEACHER_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderCalendar() {
  return render(
    <MemoryRouter>
      <CalendarPage />
    </MemoryRouter>,
  )
}

const FUTURE_DATE_1 = new Date(Date.now() + 86400000).toISOString() // +1 day
const FUTURE_DATE_2 = new Date(Date.now() + 172800000).toISOString() // +2 days

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('CalendarPage', () => {
  it('shows loading indicator while fetching', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderCalendar()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders activities fetched from GET /calendar', async () => {
    const activities = [
      {
        id: 'act-1',
        title: 'Cours de maths niveau Terminale',
        startAt: FUTURE_DATE_1,
        endAt: FUTURE_DATE_2,
        type: 'course',
        status: 'scheduled',
      },
    ]

    mockApiClient.get = vi.fn().mockResolvedValue({ data: activities })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Cours de maths niveau Terminale')).toBeDefined()
    })
  })

  it('shows empty state when no activities exist', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Aucune activité planifiée')).toBeDefined()
    })
  })

  it('shows error message on API failure', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le calendrier')).toBeDefined()
    })
  })

  it('shows access denied error for 403 response', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows "Planifier une séance" button for formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderCalendar()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /planifier une séance/i })).toBeDefined()
    })
  })

  it('hides "Planifier une séance" button for élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderCalendar()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /planifier une séance/i })).toBeNull()
    })
  })

  it('shows create form when clicking "Planifier une séance"', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderCalendar()

    await waitFor(() => {
      screen.getByRole('button', { name: /planifier une séance/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /planifier une séance/i }))

    expect(screen.getByText('Nouvelle séance')).toBeDefined()
  })

  it('calls POST /calendar with correct payload on session creation', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: {
        id: 'new-act-1',
        startAt: FUTURE_DATE_1,
        endAt: FUTURE_DATE_2,
        title: 'Nouveau cours',
        type: 'course',
      },
    })

    renderCalendar()

    await waitFor(() => {
      screen.getByRole('button', { name: /planifier une séance/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /planifier une séance/i }))

    await waitFor(() => {
      expect(screen.getByText('Nouvelle séance')).toBeDefined()
    })

    // Fill in the datetime-local inputs — they have type="datetime-local" so query by type
    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    // Fire change events directly since userEvent.type may not work well with datetime-local
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(startInput, '2030-01-15T10:00')
    startInput.dispatchEvent(new Event('change', { bubbles: true }))
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(endInput, '2030-01-15T11:00')
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /planifier$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/calendar',
        expect.objectContaining({
          type: 'course',
          teacherId: 'teacher-1',
        }),
      )
    })
  })

  it('fetches calendar with teacherId query param for formateur', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderCalendar()

    await waitFor(() => {
      const calendarCall = vi.mocked(mockApiClient.get).mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/calendar'),
      )
      expect(calendarCall).toBeDefined()
      expect(calendarCall![0]).toContain('teacherId=teacher-1')
    })
  })
})
