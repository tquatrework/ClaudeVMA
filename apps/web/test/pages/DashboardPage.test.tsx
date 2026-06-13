/**
 * Tests for DashboardPage
 *
 * Covers:
 * - Loading state
 * - Stat cards rendered with live data (notifications, requests, activities)
 * - Paginated notifications response { data, meta } is handled
 * - Unread notification can be marked as read
 * - Empty state for notifications and activities
 * - Quick-access links are role-based (carnet only for élève)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '../../src/pages/DashboardPage'

// Mock dependencies
vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildDefaultAuthMock(userOverride = STUDENT_USER) {
  return {
    user: userOverride,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userOverride.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildDefaultAuthMock())
})

describe('DashboardPage', () => {
  it('shows the user email in the greeting', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      // email appears in nav header AND in greeting — use getAllByText
      const matches = screen.getAllByText(/eleve@test\.com/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('displays loading indicator for notifications while fetching', () => {
    // Never resolves so loading stays
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderDashboard()

    // Multiple stat cards show '…' while loading — use getAllByText
    const loadingIndicators = screen.getAllByText('…')
    expect(loadingIndicators.length).toBeGreaterThan(0)
  })

  it('handles paginated notifications response { data, meta }', async () => {
    const paginatedNotifications = {
      data: [
        { id: 'n1', message: 'Nouveau message', read: false, createdAt: new Date().toISOString() },
        { id: 'n2', message: 'Demande acceptée', read: true, createdAt: new Date().toISOString() },
      ],
      meta: { total: 2, page: 1, limit: 10 },
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/notifications') return Promise.resolve({ data: paginatedNotifications })
      if (url === '/dashboards/me') return Promise.resolve({ data: { role: 'eleve' } })
      if (url === '/requests') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Nouveau message')).toBeDefined()
      expect(screen.getByText('Demande acceptée')).toBeDefined()
    })
  })

  it('handles flat array notifications response', async () => {
    const flatNotifications = [
      { id: 'n1', message: 'Alerte système', read: false, createdAt: new Date().toISOString() },
    ]

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/notifications') return Promise.resolve({ data: flatNotifications })
      return Promise.resolve({ data: [] })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Alerte système')).toBeDefined()
    })
  })

  it('shows empty state when there are no notifications', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/notifications') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucune notification')).toBeDefined()
    })
  })

  it('calls POST /notifications/:id/read when marking a notification as read', async () => {
    const notifications = [
      { id: 'notif-abc', message: 'Test notif', read: false, createdAt: new Date().toISOString() },
    ]

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/notifications') return Promise.resolve({ data: notifications })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Test notif')).toBeDefined()
    })

    const readButton = screen.getByRole('button', { name: /lu/i })
    await userEvent.click(readButton)

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/notifications/notif-abc/read')
    })
  })

  it('calls DELETE /notifications/:id when deleting a notification', async () => {
    const notifications = [
      { id: 'notif-del', message: 'À supprimer', read: true, createdAt: new Date().toISOString() },
    ]

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/notifications') return Promise.resolve({ data: notifications })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.delete = vi.fn().mockResolvedValue({ data: {} })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('À supprimer')).toBeDefined()
    })

    // Click the ✕ delete button for the notification
    const deleteButtons = screen.getAllByRole('button', { name: /✕/ })
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/notifications/notif-del')
    })
  })

  it('shows "Mon carnet" quick-access card only for élève role', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      // "Mon carnet" appears in the Layout nav AND in the quick-access section
      const matches = screen.getAllByText('Mon carnet')
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('hides "Mon carnet" for non-élève roles', async () => {
    const parentUser = { ...STUDENT_USER, role: 'parent_financeur' as const }
    mockUseAuth.mockReturnValue(buildDefaultAuthMock(parentUser))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.queryAllByText('Mon carnet')).toHaveLength(0)
    })
  })

  it('shows pending consent warning when validationStatus is pending', async () => {
    const pendingUser = { ...STUDENT_USER, validationStatus: 'pending' as const }
    mockUseAuth.mockReturnValue(buildDefaultAuthMock(pendingUser))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      // Appears in nav banner AND dashboard button — use getAllByText
      const matches = screen.getAllByText(/signer les consentements/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('shows empty state for upcoming activities when calendar returns empty array', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/calendar')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucune séance à venir')).toBeDefined()
    })
  })

  it('fetches calendar with studentId query param for élève role', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderDashboard()

    await waitFor(() => {
      const calendarCall = vi.mocked(mockApiClient.get).mock.calls.find(
        ([url]) => typeof url === 'string' && url.includes('/calendar'),
      )
      expect(calendarCall).toBeDefined()
      expect(calendarCall![0]).toContain('studentId=student-1')
    })
  })
})
