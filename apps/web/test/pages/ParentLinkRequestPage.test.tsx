/**
 * Tests for ParentLinkRequestPage
 *
 * Covers:
 * - Form display (input, info contextuelle, submit button)
 * - Successful submission → POST /parent-link-requests
 * - Error 400 (invalid studentId)
 * - Error 409 (duplicate pending request)
 * - Existing request list display (GET /parent-link-requests)
 * - Status badges rendered with correct labels
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentLinkRequestPage from '../../src/pages/ParentLinkRequestPage'

vi.mock('../../src/api/client')
vi.mock('../../src/api/parentLinkRequest')
vi.mock('../../src/hooks/useAuth')

import * as parentLinkRequestApi from '../../src/api/parentLinkRequest'
import { useAuth } from '../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchParentLinkRequests = vi.mocked(parentLinkRequestApi.fetchParentLinkRequests)
const mockCreateParentLinkRequest = vi.mocked(parentLinkRequestApi.createParentLinkRequest)

const DEFAULT_AUTH = {
  user: {
    id: 'parent-001',
    email: 'parent@test.com',
    role: 'parent_financeur' as const,
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

const SAMPLE_PENDING_REQUEST: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-001',
  parentId: 'parent-001',
  studentId: 'student-aaa',
  status: 'pending',
  requestedAt: '2026-06-01T10:00:00Z',
}

const SAMPLE_APPROVED_REQUEST: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-002',
  parentId: 'parent-001',
  studentId: 'student-bbb',
  status: 'approved',
  requestedAt: '2026-05-15T09:00:00Z',
  processedAt: '2026-05-16T11:00:00Z',
  processedBy: 'student-bbb',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ParentLinkRequestPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(DEFAULT_AUTH)
})

describe('ParentLinkRequestPage', () => {
  describe('Form display', () => {
    it('shows the page title', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      expect(screen.getByText('Rattacher un élève')).toBeDefined()
    })

    it('shows the student ID input field', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      expect(screen.getByLabelText(/identifiant de l'élève/i)).toBeDefined()
    })

    it('shows the contextual info message', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      expect(screen.getByText(/saisissez l'identifiant communiqué par l'établissement/i)).toBeDefined()
    })

    it('shows the submit button', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      expect(screen.getByRole('button', { name: /envoyer la demande/i })).toBeDefined()
    })

    it('shows a "Créer un compte élève" link opening /register/student in a new tab', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      const createStudentLink = screen.getByRole('link', { name: 'Créer un compte élève' })
      expect(createStudentLink.getAttribute('href')).toBe('/register/student')
      expect(createStudentLink.getAttribute('target')).toBe('_blank')
      expect(createStudentLink.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  describe('Successful submission', () => {
    it('calls createParentLinkRequest with the studentId and shows success message', async () => {
      const newRequest: parentLinkRequestApi.ParentLinkRequest = {
        id: 'req-new-001',
        parentId: 'parent-001',
        studentId: 'student-xyz',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      }

      mockFetchParentLinkRequests.mockResolvedValue([])
      mockCreateParentLinkRequest.mockResolvedValue(newRequest)

      renderPage()

      const input = screen.getByLabelText(/identifiant de l'élève/i)
      await userEvent.type(input, 'student-xyz')

      await userEvent.click(screen.getByRole('button', { name: /envoyer la demande/i }))

      await waitFor(() => {
        expect(mockCreateParentLinkRequest).toHaveBeenCalledWith('student-xyz')
      })

      await waitFor(() => {
        expect(screen.getByText(/votre demande de rattachement a bien été envoyée/i)).toBeDefined()
      })
    })

    it('clears the input after successful submission', async () => {
      const newRequest: parentLinkRequestApi.ParentLinkRequest = {
        id: 'req-new-002',
        parentId: 'parent-001',
        studentId: 'student-xyz',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      }

      mockFetchParentLinkRequests.mockResolvedValue([])
      mockCreateParentLinkRequest.mockResolvedValue(newRequest)

      renderPage()

      const input = screen.getByLabelText(/identifiant de l'élève/i) as HTMLInputElement
      await userEvent.type(input, 'student-xyz')
      await userEvent.click(screen.getByRole('button', { name: /envoyer la demande/i }))

      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })
  })

  describe('Error handling', () => {
    it('shows error message on 400 response (invalid studentId)', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])
      mockCreateParentLinkRequest.mockRejectedValue({ response: { status: 400 } })

      renderPage()

      const input = screen.getByLabelText(/identifiant de l'élève/i)
      await userEvent.type(input, 'bad-id')
      await userEvent.click(screen.getByRole('button', { name: /envoyer la demande/i }))

      await waitFor(() => {
        expect(screen.getByText(/cet identifiant ne correspond pas à un compte élève/i)).toBeDefined()
      })
    })

    it('shows conflict message on 409 response (duplicate pending request)', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])
      mockCreateParentLinkRequest.mockRejectedValue({ response: { status: 409 } })

      renderPage()

      const input = screen.getByLabelText(/identifiant de l'élève/i)
      await userEvent.type(input, 'student-xyz')
      await userEvent.click(screen.getByRole('button', { name: /envoyer la demande/i }))

      await waitFor(() => {
        expect(screen.getByText(/une demande de rattachement est déjà en cours/i)).toBeDefined()
      })
    })
  })

  describe('Existing request list', () => {
    it('displays existing requests loaded from GET /parent-link-requests', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_PENDING_REQUEST, SAMPLE_APPROVED_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(SAMPLE_PENDING_REQUEST.studentId, { exact: false })).toBeDefined()
        expect(screen.getByText(SAMPLE_APPROVED_REQUEST.studentId, { exact: false })).toBeDefined()
      })
    })

    it('shows status badge "En attente" for pending requests', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_PENDING_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('En attente')).toBeDefined()
      })
    })

    it('shows status badge "Approuvée" for approved requests', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_APPROVED_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Approuvée')).toBeDefined()
      })
    })

    it('shows "Aucune demande" when list is empty', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/aucune demande pour le moment/i)).toBeDefined()
      })
    })

    it('shows load error message when fetch fails', async () => {
      mockFetchParentLinkRequests.mockRejectedValue(new Error('network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/impossible de charger vos demandes/i)).toBeDefined()
      })
    })
  })
})
