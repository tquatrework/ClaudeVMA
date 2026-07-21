/**
 * Tests for TeacherRequestPage (phase 3 spec)
 *
 * Covers:
 * - Student creates a specific teacher request (POST /teacher-requests)
 * - Financeur creates a PP change request (POST /teacher-requests/pp-change)
 * - RP sees the workspace panel
 * - Formateur sees the inbox panel
 * - Request list displayed after load
 * - API error is displayed
 *
 * La page et tous ses composants enfants (RpTeacherSearchWorkspace, TeacherRequestInbox,
 * SpecificTeacherRequestForm, ChangePrincipalTeacherDialog) passent désormais par
 * `src/api/teacherRequests` (mocké ci-dessous) — plus aucun import direct d'`apiClient`
 * dans ce sous-arbre (lot teacher-requests, hors-pages).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestPage from '../../src/pages/TeacherRequestPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchTeacherRequests,
  createSpecificTeacherRequest,
  createPpChangeRequest,
} from '../../src/api/teacherRequests'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherRequests = vi.mocked(fetchTeacherRequests)
const mockCreateSpecificTeacherRequest = vi.mocked(createSpecificTeacherRequest)
const mockCreatePpChangeRequest = vi.mocked(createPpChangeRequest)

const STUDENT_USER = {
  id: 'student-001',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const PARENT_USER = {
  id: 'parent-001',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
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

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherRequestPage />
    </MemoryRouter>,
  )
}

const SAMPLE_REQUESTS = [
  {
    id: 'req-aaa111',
    status: 'pending' as const,
    createdAt: '2026-01-15T10:00:00Z',
    description: 'Besoin aide en algèbre',
  },
  {
    id: 'req-bbb222',
    status: 'accepted' as const,
    createdAt: '2026-01-10T09:00:00Z',
    description: 'Cours de géométrie',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchTeacherRequests.mockResolvedValue([])
})

describe('TeacherRequestPage', () => {
  describe('Student (élève) role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    })

    it('shows the page title', async () => {
      renderPage()

      expect(screen.getByText('Demandes professeur')).toBeDefined()
    })

    it('shows "Nouvelle demande" button', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nouvelle demande/i })).toBeDefined()
      })
    })

    it('shows "Changer le prof principal" button for student', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /changer le prof principal/i })).toBeDefined()
      })
    })

    it('shows specific request form when clicking "Nouvelle demande"', async () => {
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle demande/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

      expect(screen.getByText('Nouvelle demande de professeur')).toBeDefined()
    })

    it('student creates a specific teacher request via POST /teacher-requests', async () => {
      const createdRequest = {
        id: 'req-new-001',
        status: 'pending',
        createdAt: new Date().toISOString(),
        subject: 'Algèbre',
        level: 'Terminale',
        sector: 'Générale',
      }

      mockCreateSpecificTeacherRequest.mockResolvedValue(createdRequest)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle demande/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

      // Remplir les champs obligatoires du formulaire : sujet, niveau, filière
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. algèbre/i),
        'Algèbre',
      )
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. 3ème/i),
        'Terminale',
      )
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. générale/i),
        'Générale',
      )

      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        expect(mockCreateSpecificTeacherRequest).toHaveBeenCalledWith(
          expect.objectContaining({ subject: 'Algèbre', level: 'Terminale', sector: 'Générale' }),
        )
      })
    })

    it('shows success message after request creation', async () => {
      const createdRequest = {
        id: 'req-new-002',
        status: 'pending',
        createdAt: new Date().toISOString(),
        subject: 'Géométrie',
        level: '3ème',
        sector: 'Générale',
      }

      mockCreateSpecificTeacherRequest.mockResolvedValue(createdRequest)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle demande/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. algèbre/i),
        'Géométrie',
      )
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. 3ème/i),
        '3ème',
      )
      await userEvent.type(
        screen.getByPlaceholderText(/ex\. générale/i),
        'Générale',
      )
      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        expect(screen.getByText(/votre demande a bien été soumise/i)).toBeDefined()
      })
    })

    it('opens PP change dialog when clicking "Changer le prof principal"', async () => {
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /changer le prof principal/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /changer le prof principal/i }))

      expect(screen.getByText('Changer le professeur principal')).toBeDefined()
    })

    it('displays request list from GET /teacher-requests', async () => {
      mockFetchTeacherRequests.mockResolvedValue(SAMPLE_REQUESTS)

      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/besoin aide en algèbre/i)).toBeDefined()
        expect(screen.getByText(/cours de géométrie/i)).toBeDefined()
      })
    })

    it('shows API error when loading fails', async () => {
      mockFetchTeacherRequests.mockRejectedValue({ response: { status: 500 } })

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Impossible de charger les demandes')).toBeDefined()
      })
    })
  })

  describe('Financeur (parent_financeur) creates PP change request', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    })

    it('shows "Changer le prof principal" button for parent', async () => {
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /changer le prof principal/i })).toBeDefined()
      })
    })

    it('financeur submits PP change via POST /teacher-requests/pp-change', async () => {
      const ppChangeResponse = {
        id: 'req-ppchange-001',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      mockCreatePpChangeRequest.mockResolvedValue(ppChangeResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /changer le prof principal/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /changer le prof principal/i }))

      // Dialog opens
      expect(screen.getByText('Changer le professeur principal')).toBeDefined()

      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        expect(mockCreatePpChangeRequest).toHaveBeenCalledWith(
          expect.objectContaining({ studentId: PARENT_USER.id }),
        )
      })
    })

    it('shows success message after PP change submission', async () => {
      const ppChangeResponse = {
        id: 'req-ppchange-002',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }

      mockCreatePpChangeRequest.mockResolvedValue(ppChangeResponse)

      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /changer le prof principal/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /changer le prof principal/i }))
      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        expect(screen.getByText(/demande de changement de professeur principal/i)).toBeDefined()
      })
    })
  })

  describe('RP (responsable_pedagogique) role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    })

    it('shows RP workspace section', async () => {
      mockFetchTeacherRequests.mockResolvedValue([])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Demandes à traiter')).toBeDefined()
      })
    })

    it('RP selects candidates — workspace shows pending requests', async () => {
      const pendingRequest = {
        id: 'req-rp-001',
        status: 'pending' as const,
        createdAt: '2026-01-15T10:00:00Z',
        description: 'Demande active',
      }

      // RpTeacherSearchWorkspace et la liste principale partagent la même source
      // (`fetchTeacherRequests`, mockée ci-dessus).
      mockFetchTeacherRequests.mockResolvedValue([pendingRequest])

      renderPage()

      await waitFor(() => {
        // The request description appears both in RpTeacherSearchWorkspace and in the main list
        const matchingElements = screen.getAllByText(/demande active/i)
        expect(matchingElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Teacher (formateur) role', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    })

    it('shows teacher inbox section', async () => {
      mockFetchTeacherRequests.mockResolvedValue([])

      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Demandes reçues')).toBeDefined()
      })
    })

    it('does not show "Nouvelle demande" button for formateur', async () => {
      mockFetchTeacherRequests.mockResolvedValue([])

      renderPage()

      await waitFor(() => {
        screen.getByText('Demandes reçues')
      })

      expect(screen.queryByRole('button', { name: /nouvelle demande/i })).toBeNull()
    })
  })
})
