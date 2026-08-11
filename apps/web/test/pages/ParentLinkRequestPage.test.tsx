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
 * - Chaque demande nomme l'élève, jamais son identifiant technique
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentLinkRequestPage from '../../src/pages/ParentLinkRequestPage'

vi.mock('../../src/api/client')
vi.mock('../../src/api/parentLinkRequest')
vi.mock('../../src/api/relations')
vi.mock('../../src/hooks/useAuth')

import * as parentLinkRequestApi from '../../src/api/parentLinkRequest'
import { fetchLinkedStudents } from '../../src/api/relations'
import { useAuth } from '../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchParentLinkRequests = vi.mocked(parentLinkRequestApi.fetchParentLinkRequests)
const mockCreateParentLinkRequest = vi.mocked(parentLinkRequestApi.createParentLinkRequest)
const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)

const DEFAULT_AUTH = {
  user: {
    id: 'parent-001',
    loginIdentifier: 'jean.parent',
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
  direction: 'parent_initiated',
  requestedAt: '2026-06-01T10:00:00Z',
}

const SAMPLE_APPROVED_REQUEST: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-002',
  parentId: 'parent-001',
  studentId: 'student-bbb',
  status: 'approved',
  direction: 'parent_initiated',
  requestedAt: '2026-05-15T09:00:00Z',
  processedAt: '2026-05-16T11:00:00Z',
  processedBy: 'student-bbb',
}

/**
 * `GET /relations/finance-owner-student/:financeOwnerId` renvoie déjà le nom de
 * l'élève, résolu côté serveur. C'est la seule source du nom pour un parent :
 * `GET /profiles/:studentId` répond 403 tant que le rattachement n'est pas
 * accepté (vérifié sur la pile réelle le 2026-08-11).
 *
 * Seul l'élève déjà rattaché (demande approuvée) y figure.
 */
const LINKED_STUDENTS = [
  {
    financeOwnerId: 'parent-001',
    studentId: 'student-bbb',
    createdAt: '2026-05-16T11:00:00Z',
    studentName: { firstName: 'Chloé', lastName: 'Bernard' },
  },
]

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
  mockFetchLinkedStudents.mockResolvedValue(LINKED_STUDENTS)
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

    it('shows a "Créer un compte élève" link opening /register/student with the current parent pre-linked, in a new tab', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([])

      renderPage()

      const createStudentLink = screen.getByRole('link', { name: 'Créer un compte élève' })
      expect(createStudentLink.getAttribute('href')).toBe(
        '/register/student?parentLoginIdentifier=jean.parent',
      )
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
    it('nomme l\'élève rattaché avec son prénom et son nom', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_APPROVED_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Chloé Bernard')).toBeDefined()
      })
    })

    it('annonce en français que le nom n\'est pas communiqué pour une demande en attente', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_PENDING_REQUEST])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Élève — nom non communiqué')).toBeDefined()
      })
    })

    it('n\'affiche jamais l\'identifiant technique de l\'élève, même tronqué', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_PENDING_REQUEST, SAMPLE_APPROVED_REQUEST])

      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getByText('Chloé Bernard')).toBeDefined()
      })

      const renderedText = container.textContent ?? ''
      expect(renderedText).not.toContain(SAMPLE_PENDING_REQUEST.studentId)
      expect(renderedText).not.toContain(SAMPLE_APPROVED_REQUEST.studentId)
      expect(renderedText).not.toContain('ELV-')
    })

    it('reste lisible quand les relations sont inaccessibles', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([SAMPLE_APPROVED_REQUEST])
      mockFetchLinkedStudents.mockRejectedValue(new Error('network error'))

      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getByText('Élève — nom non communiqué')).toBeDefined()
      })
      expect(container.textContent ?? '').not.toContain(SAMPLE_APPROVED_REQUEST.studentId)
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
