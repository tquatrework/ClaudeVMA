/**
 * Tests for TeacherRequestsPage
 *
 * Covers:
 * - Fetches requests from GET /requests
 * - Loading state
 * - Empty state (no requests)
 * - Filter tabs (pending, accepted, declined, cancelled)
 * - Empty state when a filter matches no items
 * - "Nouvelle demande" button shown only for authorised roles
 * - Creating a request calls POST /requests
 * - API error is displayed
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestsPage from '../../src/pages/TeacherRequestsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchTeacherRequests, createTeacherRequest } from '../../src/api/teacherRequests'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherRequests = vi.mocked(fetchTeacherRequests)
const mockCreateTeacherRequest = vi.mocked(createTeacherRequest)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
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

function renderTeacherRequests() {
  return render(
    <MemoryRouter>
      <TeacherRequestsPage />
    </MemoryRouter>,
  )
}

const SAMPLE_REQUESTS = [
  {
    id: 'req-aaa111bb',
    status: 'pending' as const,
    createdAt: '2026-01-15T10:00:00Z',
    description: 'Besoin aide en algèbre',
  },
  {
    id: 'req-bbb222cc',
    status: 'accepted' as const,
    createdAt: '2026-01-10T09:00:00Z',
    description: 'Cours de géométrie',
  },
  {
    id: 'req-ccc333dd',
    status: 'declined' as const,
    createdAt: '2026-01-05T08:00:00Z',
    description: null,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('TeacherRequestsPage', () => {
  it('shows loading state while fetching', () => {
    mockFetchTeacherRequests.mockReturnValue(new Promise(() => {}))

    renderTeacherRequests()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders a list of teacher requests', async () => {
    mockFetchTeacherRequests.mockResolvedValue(SAMPLE_REQUESTS)

    renderTeacherRequests()

    await waitFor(() => {
      // IDs are sliced to 8 chars in the UI: 'req-aaa1' from 'req-aaa111bb', 'req-bbb2' from 'req-bbb222cc'
      expect(screen.getByText(/req-aaa1/i)).toBeDefined()
      expect(screen.getByText(/req-bbb2/i)).toBeDefined()
    })
  })

  it('shows request descriptions', async () => {
    mockFetchTeacherRequests.mockResolvedValue(SAMPLE_REQUESTS)

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByText('Besoin aide en algèbre')).toBeDefined()
    })
  })

  it('shows empty state when no requests exist', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByText('Aucune demande')).toBeDefined()
    })
  })

  it('shows API error when requests fail to load', async () => {
    mockFetchTeacherRequests.mockRejectedValue({ response: { status: 500 } })

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les demandes')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for 403 error', async () => {
    mockFetchTeacherRequests.mockRejectedValue({ response: { status: 403 } })

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows filter tabs after requests are loaded', async () => {
    mockFetchTeacherRequests.mockResolvedValue(SAMPLE_REQUESTS)

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toutes/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /en attente/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /acceptée/i })).toBeDefined()
    })
  })

  it('filters requests by "pending" status when filter button is clicked', async () => {
    mockFetchTeacherRequests.mockResolvedValue(SAMPLE_REQUESTS)

    renderTeacherRequests()

    await waitFor(() => {
      screen.getByRole('button', { name: /en attente/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /en attente/i }))

    await waitFor(() => {
      // Only the pending request should be visible
      expect(screen.getByText('Besoin aide en algèbre')).toBeDefined()
      // The accepted request description should be gone
      expect(screen.queryByText('Cours de géométrie')).toBeNull()
    })
  })

  it('shows empty filtered state when no requests match the filter', async () => {
    // Only pending, no cancelled
    mockFetchTeacherRequests.mockResolvedValue([SAMPLE_REQUESTS[0]])

    renderTeacherRequests()

    await waitFor(() => {
      screen.getByRole('button', { name: /annulée/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /annulée/i }))

    await waitFor(() => {
      expect(screen.getByText(/aucune demande avec le statut/i)).toBeDefined()
    })
  })

  it('shows "Nouvelle demande" button for élève role', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouvelle demande/i })).toBeDefined()
    })
  })

  it('hides "Nouvelle demande" button for formateur role', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchTeacherRequests.mockResolvedValue([])

    renderTeacherRequests()

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /nouvelle demande/i })).toBeNull()
    })
  })

  it('shows the create form when clicking "Nouvelle demande"', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderTeacherRequests()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvelle demande/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

    expect(screen.getByText('Nouvelle demande professeur')).toBeDefined()
  })

  it('calls POST /requests with description on form submit', async () => {
    const newRequest = {
      id: 'req-new-001',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      description: 'Aide en analyse',
    }

    mockFetchTeacherRequests.mockResolvedValue([])
    mockCreateTeacherRequest.mockResolvedValue(newRequest)

    renderTeacherRequests()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvelle demande/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

    await userEvent.type(
      screen.getByPlaceholderText(/décrivez le besoin/i),
      'Aide en analyse',
    )

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(mockCreateTeacherRequest).toHaveBeenCalledWith({
        description: 'Aide en analyse',
      })
    })
  })

  it('adds the new request to the list after creation', async () => {
    const newRequest = {
      id: 'req-new-001',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      description: 'Aide en analyse',
    }

    mockFetchTeacherRequests.mockResolvedValue([])
    mockCreateTeacherRequest.mockResolvedValue(newRequest)

    renderTeacherRequests()

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvelle demande/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))
    await userEvent.type(
      screen.getByPlaceholderText(/décrivez le besoin/i),
      'Aide en analyse',
    )
    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(screen.getByText('Aide en analyse')).toBeDefined()
    })
  })
})
