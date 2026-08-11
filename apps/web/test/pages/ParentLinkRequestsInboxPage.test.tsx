/**
 * Tests for ParentLinkRequestsInboxPage
 *
 * Covers:
 * - Only pending requests are displayed
 * - Chaque demande nomme le demandeur, jamais son identifiant technique
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
vi.mock('../../src/api/relations')
vi.mock('../../src/hooks/useAuth')

import * as parentLinkRequestApi from '../../src/api/parentLinkRequest'
import { fetchLinkedParents, fetchStudentProfile } from '../../src/api/relations'
import { useAuth } from '../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchParentLinkRequests = vi.mocked(parentLinkRequestApi.fetchParentLinkRequests)
const mockApproveParentLinkRequest = vi.mocked(parentLinkRequestApi.approveParentLinkRequest)
const mockRejectParentLinkRequest = vi.mocked(parentLinkRequestApi.rejectParentLinkRequest)
const mockFetchLinkedParents = vi.mocked(fetchLinkedParents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)

/**
 * Libellé de repli attendu tant que le nom du demandeur n'est pas accessible.
 *
 * Ce n'est pas un pis-aller de test : sur la pile réelle, un élève reçoit 403 sur
 * `GET /profiles/<parent>` — avant comme après le rattachement (« An élève may
 * only view their own profile »), et `GET /parent-link-requests` ne porte que des
 * identifiants. L'écran n'a donc rien d'humain à afficher, et l'écrire vaut mieux
 * que de recracher un UUID.
 */
const UNDISCLOSED_FINANCE_OWNER_LABEL = 'Parent financeur — nom non communiqué'

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

const RESPONSABLE_PEDAGOGIQUE_AUTH = {
  ...DEFAULT_AUTH,
  user: {
    id: 'rp-001',
    email: 'rp@test.com',
    role: 'responsable_pedagogique' as const,
    validationStatus: 'active' as const,
  },
  isInternalRole: vi.fn(() => true),
}

const PENDING_REQUEST_ONE: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-001',
  parentId: 'parent-aaa',
  studentId: 'student-001',
  status: 'pending',
  direction: 'parent_initiated',
  requestedAt: '2026-06-10T08:00:00Z',
}

const PENDING_REQUEST_TWO: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-002',
  parentId: 'parent-bbb',
  studentId: 'student-001',
  status: 'pending',
  direction: 'parent_initiated',
  requestedAt: '2026-06-11T09:00:00Z',
}

const APPROVED_REQUEST: parentLinkRequestApi.ParentLinkRequest = {
  id: 'req-003',
  parentId: 'parent-ccc',
  studentId: 'student-001',
  status: 'approved',
  direction: 'parent_initiated',
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
  // Une demande en attente précède le rattachement : aucun parent lié, donc aucun
  // nom résolu par les relations pour l'élève qui doit décider.
  mockFetchLinkedParents.mockResolvedValue([])
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

      // Une seule demande affichée : la demande déjà approuvée n'a plus de décision
      // à recueillir et ne doit pas encombrer la boîte de réception.
      await waitFor(() => {
        expect(screen.getAllByRole('listitem').length).toBe(1)
      })
      expect(screen.getByText('10 juin 2026', { exact: false })).toBeDefined()
      expect(screen.queryByText('5 juin 2026', { exact: false })).toBeNull()
    })

    it('nomme le demandeur de chaque demande, jamais son identifiant', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE, PENDING_REQUEST_TWO])

      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getAllByText(UNDISCLOSED_FINANCE_OWNER_LABEL).length).toBe(2)
      })

      const renderedText = container.textContent ?? ''
      expect(renderedText).not.toContain(PENDING_REQUEST_ONE.parentId)
      expect(renderedText).not.toContain(PENDING_REQUEST_TWO.parentId)
      expect(renderedText).not.toContain('PAR-')
    })

    it('avertit que le nom du demandeur n\'est pas communiqué avant acceptation', async () => {
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])

      renderPage()

      await waitFor(() => {
        expect(
          screen.getByText(/le nom du demandeur n'est pas communiqué par la plateforme/i),
        ).toBeDefined()
      })
    })

    it('affiche le prénom et le nom du demandeur quand le lecteur peut les lire (RP)', async () => {
      mockUseAuth.mockReturnValue(RESPONSABLE_PEDAGOGIQUE_AUTH)
      mockFetchParentLinkRequests.mockResolvedValue([PENDING_REQUEST_ONE])
      mockFetchStudentProfile.mockResolvedValue({
        userId: 'parent-aaa',
        loginIdentifier: 'sophie.moreau',
        administrative: { firstName: 'Sophie', lastName: 'Moreau' },
      })

      const { container } = renderPage()

      await waitFor(() => {
        expect(screen.getByText('Sophie Moreau')).toBeDefined()
      })
      expect(mockFetchStudentProfile).toHaveBeenCalledWith('parent-aaa')
      expect(container.textContent ?? '').not.toContain(PENDING_REQUEST_ONE.parentId)
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
        // Only one pending request should remain — celle du 11 juin.
        expect(screen.getAllByRole('button', { name: /accepter/i }).length).toBe(1)
        expect(screen.getByText('11 juin 2026', { exact: false })).toBeDefined()
      })
      expect(screen.queryByText('10 juin 2026', { exact: false })).toBeNull()
    })
  })
})
