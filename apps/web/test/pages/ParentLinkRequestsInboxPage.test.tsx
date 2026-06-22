/**
 * Tests for ParentLinkRequestsInboxPage
 *
 * Covers:
 * - Only pending requests are displayed
 * - Each request shows parentId and date
 * - Accepter button calls approveParentLinkRequest
 * - Refuser button calls rejectParentLinkRequest
 * - After approve: request disappears from list (status updated locally)
 * - After reject: request disappears from list (status updated locally)
 * - Empty state when no pending requests
 * - Load error message when fetch fails
 * - Action error message on approve/reject failure
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentLinkRequestsInboxPage from '../../src/pages/ParentLinkRequestsInboxPage'

vi.mock('../../src/api/client')
vi.mock('../../src/api/parentLinkRequest')
vi.mock('../../src/hooks/useAuth')

import * as parentLinkRequestApi from '../../src/api/parentLinkRequest'
import { useAuth } from '../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchParentLinkRequests = vi.mocked(parentLinkRequestApi.fetchParentLinkRequests)
const mockApproveParentLinkRequest = vi.mocked(parentLinkRequestApi.approveParentLinkRequest)
const mockRejectParentLinkRequest = vi.mocked(parentLinkRequestApi.rejectParentLinkRequest)

const DEFAULT_AUTH = {
  user: {
    id: 'student-001',
    email: 'eleve@test.com',
    role: 'eleve' as const,
    validationStatus: 'active' as const,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => false),
  isInternalRole: vi.fn(() => false),
  refreshUser: vi.fn(),
}

const PENDING_REQUEST_ONE: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-001',
  parentId: 'parent-aaa',
  studentId: 'student-001',
  status: 'pending',
  requestedAt: '2026-06-10T08:00:00Z',
}

const PENDING_REQUEST_TWO: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-002',
  parentId: 'parent-bbb',
  studentId: 'student-001',
  status: 'pending',
  requestedAt: '2026-06-11T09:00:00Z',
}

const APPROVED_REQUEST: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-003',
  parentId: 'parent-ccc',
  studentId: 'student-001',
  status: 'approved',
  requestedAt: '2026-06-05T07:00:00Z',
  processedAt: '2026-06-06T10:00:00Z',
  processedBy: 'student-001',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ParentLinkRequestsInboxPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(DEFAULT_AUTH)
})

describe('ParentLinkRequestsInboxPage', () => {
  describe('Display', () => {
    it('shows the page title', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      expect(screen.getByText('Demandes de rattachement')).toBeDefined()
    })

    it('shows only pending requests (filters out non-pending)', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([
        PENDING_REQUEST_ONE,
        APPROVED_REQUEST,
      ])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(PENDING_REQUEST_ONE.parentId, { exact: false })).toBeDefined()
      })

      // approved request should not appear in the inbox
      expect(screen.queryByText(APPROVED_REQUEST.parentId, { exact: false })).toBeNull()
    })

    it('shows parentId for each pending request', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE, PENDING_REQUEST_TWO])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(PENDING_REQUEST_ONE.parentId, { exact: false })).toBeDefined()
        expect(screen.getByText(PENDING_REQUEST_TWO.parentId, { exact: false })).toBeDefined()
      })
    })

    it('shows Accepter and Refuser buttons for each pending request', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])

      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /accepter/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()
      })
    })

    it('shows empty state when no pending requests', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([APPROVED_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/aucune demande en attente/i)).toBeDefined()
      })
    })

    it('shows load error message when fetch fails', async () => {
      mockFetchParentLinkRequests.mockRejectedValue(new Error('network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/impossible de charger les demandes/i)).toBeDefined()
      })
    })
  })

  describe('Approve action', () => {
    it('calls approveParentLinkRequest with the request id', async () => {
      const approvedResponse: parentLinkRequestApi.ParentLinkRequest = {
        ...PENDING_REQUEST_ONE,
        status: 'approved',
        processedAt: new Date().toISOString(),
        processedBy: 'student-001',
      }

      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockApproveParentLinkRequest.mockResolvedValue(approvedResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /accepter/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

      await waitFor(() => {
        expect(mockApproveParentLinkRequest).toHaveBeenCalledWith(PENDING_REQUEST_ONE.id)
      })
    })

    it('removes the request from the list after approval', async () => {
      const approvedResponse: parentLinkRequestApi.ParentLinkRequest = {
        ...PENDING_REQUEST_ONE,
        status: 'approved',
        processedAt: new Date().toISOString(),
        processedBy: 'student-001',
      }

      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockApproveParentLinkRequest.mockResolvedValue(approvedResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /accepter/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

      await waitFor(() => {
        expect(screen.getByText(/aucune demande en attente/i)).toBeDefined()
      })
    })

    it('shows action error when approval fails', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockApproveParentLinkRequest.mockRejectedValue(new Error('server error'))

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /accepter/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

      await waitFor(() => {
        expect(screen.getByText(/impossible de traiter la demande/i)).toBeDefined()
      })
    })
  })

  describe('Reject action', () => {
    it('calls rejectParentLinkRequest with the request id', async () => {
      const rejectedResponse: parentLinkRequestApi.ParentLinkRequest = {
        ...PENDING_REQUEST_ONE,
        status: 'rejected',
        processedAt: new Date().toISOString(),
        processedBy: 'student-001',
      }

      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockRejectParentLinkRequest.mockResolvedValue(rejectedResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /refuser/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

      await waitFor(() => {
        expect(mockRejectParentLinkRequest).toHaveBeenCalledWith(PENDING_REQUEST_ONE.id)
      })
    })

    it('removes the request from the list after rejection', async () => {
      const rejectedResponse: parentLinkRequestApi.ParentLinkRequest = {
        ...PENDING_REQUEST_ONE,
        status: 'rejected',
        processedAt: new Date().toISOString(),
        processedBy: 'student-001',
      }

      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockRejectParentLinkRequest.mockResolvedValue(rejectedResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /refuser/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

      await waitFor(() => {
        expect(screen.getByText(/aucune demande en attente/i)).toBeDefined()
      })
    })

    it('shows action error when rejection fails', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockRejectParentLinkRequest.mockRejectedValue(new Error('server error'))

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /refuser/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

      await waitFor(() => {
        expect(screen.getByText(/impossible de traiter la demande/i)).toBeDefined()
      })
    })
  })

  describe('Multiple pending requests', () => {
    it('keeps remaining pending requests after one is approved', async () => {
      const approvedResponse: parentLinkRequestApi.ParentLinkRequest = {
        ...PENDING_REQUEST_ONE,
        status: 'approved',
        processedAt: new Date().toISOString(),
      }

      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE, PENDING_REQUEST_TWO])
      mockApproveParentLinkRequest.mockResolvedValue(approvedResponse)

      renderPage()

      await waitFor(() => {
        const acceptButtons = screen.getAllByRole('button', { name: /accepter/i })
        expect(acceptButtons.length).toBe(2)
      })

      // Click Accepter on the first request
      const acceptButtons = screen.getAllByRole('button', { name: /accepter/i })
      await userEvent.click(acceptButtons[0])

      await waitFor(() => {
        // Only one pending request should remain
        expect(screen.getAllByRole('button', { name: /accepter/i }).length).toBe(1)
        expect(screen.getByText(PENDING_REQUEST_TWO.parentId, { exact: false })).toBeDefined()
      })
    })
  })
})
