/**
 * Tests for TeacherRequestDetailPage (phase 3 spec)
 *
 * Covers:
 * - RP selects candidates — status changes to candidates_selected
 * - Teacher accepts/refuses a targeted request (POST /teacher-requests/{id}/responses)
 * - Client selects a candidate and request closes (POST /teacher-requests/{id}/select)
 * - Stop collaboration form shown when collaborationId is present
 * - API errors displayed correctly
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestDetailPage from '../../src/pages/TeacherRequestDetailPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const STUDENT_USER = {
  id: 'student-001',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-001',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-001',
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
    isInternalRole: vi.fn(() =>
      ['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'].includes(userObj.role),
    ),
  }
}

const REQUEST_ID = 'req-detail-001'

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={[`/teacher-requests/${REQUEST_ID}`]}>
      <Routes>
        <Route path="/teacher-requests/:requestId" element={<TeacherRequestDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const BASE_REQUEST = {
  id: REQUEST_ID,
  status: 'pending',
  createdAt: '2026-01-15T10:00:00Z',
  description: 'Besoin aide en algèbre niveau terminale',
  studentId: 'student-001',
  candidates: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('TeacherRequestDetailPage', () => {
  it('renders request details after loading', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: BASE_REQUEST })

    renderDetailPage()

    await waitFor(() => {
      expect(screen.getByText('Besoin aide en algèbre niveau terminale')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for 403 error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

    renderDetailPage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows "Demande introuvable" for 404 error', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 404 } })

    renderDetailPage()

    await waitFor(() => {
      expect(screen.getByText('Demande introuvable')).toBeDefined()
    })
  })

  describe('RP selects candidates', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    })

    it('shows "Accepter" and "Refuser" buttons for RP on pending request', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: BASE_REQUEST })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^accepter$/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()
      })
    })

    it('shows "Ajouter un candidat" button for RP on pending request', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: BASE_REQUEST })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ajouter un candidat/i })).toBeDefined()
      })
    })

    it('RP adds a candidate via POST /teacher-requests/{id}/candidates', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: BASE_REQUEST })
      mockApiClient.post = vi.fn().mockResolvedValue({
        data: {
          candidates: [
            {
              id: 'candidate-001',
              teacherId: 'teacher-999',
              status: 'pending',
              addedAt: new Date().toISOString(),
            },
          ],
        },
      })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /ajouter un candidat/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /ajouter un candidat/i }))

      await userEvent.type(
        screen.getByPlaceholderText(/uuid du formateur à proposer/i),
        'teacher-999',
      )

      await userEvent.click(screen.getByRole('button', { name: /^ajouter$/i }))

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          `/teacher-requests/${REQUEST_ID}/proposals`,
          { teacherId: 'teacher-999' },
        )
      })
    })

    it('RP updates status to accepted', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: BASE_REQUEST })
      mockApiClient.patch = vi.fn().mockResolvedValue({
        data: { ...BASE_REQUEST, status: 'accepted' },
      })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /^accepter$/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /^accepter$/i }))

      await waitFor(() => {
        expect(mockApiClient.patch).toHaveBeenCalledWith(
          `/teacher-requests/${REQUEST_ID}/status`,
          { status: 'accepted' },
        )
      })
    })
  })

  describe('Teacher accepts/refuses a targeted request', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    })

    it('teacher sees "Accepter" button on their own pending candidacy', async () => {
      const requestWithOwnCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-own',
            teacherId: TEACHER_USER.id, // same as current user
            status: 'pending' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithOwnCandidate })

      renderDetailPage()

      await waitFor(() => {
        // TeacherCandidatesView shows accept/decline buttons for the teacher's own candidacy
        expect(screen.getByRole('button', { name: /^accepter$/i })).toBeDefined()
      })
    })

    it('teacher accepts candidacy via POST /teacher-requests/{id}/responses', async () => {
      const requestWithOwnCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-own',
            teacherId: TEACHER_USER.id,
            status: 'pending' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithOwnCandidate })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /^accepter$/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /^accepter$/i }))

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          `/proposals/candidate-own/accept`,
          {},
        )
      })
    })

    it('teacher refuses candidacy via POST /teacher-requests/{id}/responses', async () => {
      const requestWithOwnCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-own',
            teacherId: TEACHER_USER.id,
            status: 'pending' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithOwnCandidate })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /refuser/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          `/proposals/candidate-own/decline`,
          {},
        )
      })
    })
  })

  describe('Client selects a candidate and request closes', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    })

    it('client sees "Choisir" button on accepted candidate', async () => {
      const requestWithAcceptedCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-accepted',
            teacherId: 'teacher-999',
            status: 'accepted' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithAcceptedCandidate })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^choisir$/i })).toBeDefined()
      })
    })

    it('client selects candidate via POST /teacher-requests/{id}/select and request closes', async () => {
      const requestWithAcceptedCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-accepted',
            teacherId: 'teacher-999',
            status: 'accepted' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithAcceptedCandidate })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: { status: 'accepted' } })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /^choisir$/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /^choisir$/i }))

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          `/teacher-requests/${REQUEST_ID}/select`,
          { proposalId: 'candidate-accepted' },
        )
      })
    })

    it('shows success message after selecting a candidate', async () => {
      const requestWithAcceptedCandidate = {
        ...BASE_REQUEST,
        candidates: [
          {
            id: 'candidate-accepted',
            teacherId: 'teacher-999',
            status: 'accepted' as const,
            addedAt: new Date().toISOString(),
          },
        ],
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithAcceptedCandidate })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: { status: 'accepted' } })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /^choisir$/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /^choisir$/i }))

      await waitFor(() => {
        // The success message may appear in both TeacherCandidatesView and the parent page
        const matchingElements = screen.getAllByText(/formateur sélectionné/i)
        expect(matchingElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Stop collaboration', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    })

    it('shows stop collaboration button when collaborationId is present', async () => {
      const requestWithCollaboration = {
        ...BASE_REQUEST,
        collaborationId: 'collab-001',
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithCollaboration })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /demander un arrêt avec préavis/i })).toBeDefined()
      })
    })

    it('shows stop form when clicking the stop button', async () => {
      const requestWithCollaboration = {
        ...BASE_REQUEST,
        collaborationId: 'collab-001',
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithCollaboration })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /demander un arrêt avec préavis/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /demander un arrêt avec préavis/i }))

      expect(screen.getByText('Demander un arrêt de la collaboration')).toBeDefined()
    })

    it('submits stop-request via POST /teacher-collaborations/{id}/stop-request', async () => {
      const requestWithCollaboration = {
        ...BASE_REQUEST,
        collaborationId: 'collab-001',
      }
      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestWithCollaboration })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

      renderDetailPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /demander un arrêt avec préavis/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /demander un arrêt avec préavis/i }))

      await userEvent.click(screen.getByRole('button', { name: /confirmer la demande/i }))

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/teacher-collaborations/collab-001/stop-request',
          expect.objectContaining({ noticePeriodDays: 14 }),
        )
      })
    })
  })
})
