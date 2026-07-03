/**
 * Tests — Parcours élève "demande de professeur" (bug fix 404 GET /teacher-requests)
 *
 * Contexte du bug corrigé :
 * Le frontend appelait GET /teacher-requests/requests au lieu de GET /teacher-requests.
 * Le correctif a aligné toutes les URLs frontend sur les routes backend réelles.
 *
 * Cas couverts :
 * 1. État vide : GET /teacher-requests → [] → message "Vous n'avez pas pour l'instant de professeur attitré"
 * 2. Liste avec demandes : GET /teacher-requests → [...] → demandes affichées
 * 3. Appel API correct : le composant appelle /teacher-requests (sans suffixe /requests)
 * 4. Création de demande : POST /teacher-requests (sans suffixe /requests)
 * 5. Détail d'une demande : GET /teacher-requests/:id (sans segment /requests/ doublé)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRequestPage from '../../src/pages/TeacherRequestPage'
import TeacherRequestsPage from '../../src/pages/TeacherRequestsPage'
import TeacherRequestDetailPage from '../../src/pages/TeacherRequestDetailPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const STUDENT_USER = {
  id: 'student-fix-001',
  email: 'eleve-fix@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildStudentAuthMock() {
  return {
    user: STUDENT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(STUDENT_USER.role)),
    isInternalRole: vi.fn(() => false),
  }
}

const SAMPLE_REQUESTS = [
  {
    id: 'req-fix-aaa111',
    status: 'pending' as const,
    createdAt: '2026-06-01T10:00:00Z',
    description: 'Besoin aide urgente en algèbre terminale',
  },
  {
    id: 'req-fix-bbb222',
    status: 'accepted' as const,
    createdAt: '2026-05-28T09:00:00Z',
    description: 'Cours de géométrie niveau seconde',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildStudentAuthMock())
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. État vide — TeacherRequestPage (composant principal élève)
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug fix — URL correcte GET /teacher-requests', () => {
  describe('1. État vide — TeacherRequestPage', () => {
    it('affiche le message "Vous n\'avez pas pour l\'instant de professeur attitré" quand GET /teacher-requests retourne []', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(
          screen.getByText("Vous n'avez pas pour l'instant de professeur attitré"),
        ).toBeDefined()
      })
    })

    it('n\'affiche PAS d\'erreur technique quand la liste est vide (pas de 404)', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(
          screen.getByText("Vous n'avez pas pour l'instant de professeur attitré"),
        ).toBeDefined()
      })

      // Aucun message d'erreur ne doit apparaître
      expect(screen.queryByText(/impossible de charger/i)).toBeNull()
      expect(screen.queryByText(/erreur/i)).toBeNull()
      expect(screen.queryByText(/404/)).toBeNull()
    })

    it('affiche "Aucune demande" (état vide générique) dans TeacherRequestsPage quand GET /teacher-requests retourne []', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestsPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Aucune demande')).toBeDefined()
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Liste avec demandes — affichage correct
  // ─────────────────────────────────────────────────────────────────────────
  describe('2. Liste avec demandes — TeacherRequestPage', () => {
    it('affiche les demandes retournées par GET /teacher-requests', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_REQUESTS })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText(/besoin aide urgente en algèbre terminale/i)).toBeDefined()
        expect(screen.getByText(/cours de géométrie niveau seconde/i)).toBeDefined()
      })
    })

    it('affiche les statuts des demandes avec les libellés français corrects', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_REQUESTS })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('En attente')).toBeDefined()
        expect(screen.getByText('Acceptée')).toBeDefined()
      })
    })

    it('affiche les demandes dans TeacherRequestsPage', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_REQUESTS })

      render(
        <MemoryRouter>
          <TeacherRequestsPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        // Les IDs sont affichés tronqués à 8 caractères — deux demandes → getAllByText
        const idElements = screen.getAllByText(/req-fix-/i)
        expect(idElements.length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText(/besoin aide urgente en algèbre terminale/i)).toBeDefined()
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Appel API correct — vérification de l'URL sans segment parasite /requests
  // ─────────────────────────────────────────────────────────────────────────
  describe('3. URL de l\'appel API — sans suffixe /requests parasite', () => {
    it('TeacherRequestPage appelle GET /teacher-requests (pas /teacher-requests/requests)', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/teacher-requests')
      })

      // Vérification explicite : l'ancienne URL bugguée ne doit PAS être appelée
      const allGetCalls = vi.mocked(mockApiClient.get).mock.calls
      const buggedUrlCalled = allGetCalls.some(
        (callArgs) => callArgs[0] === '/teacher-requests/requests',
      )
      expect(buggedUrlCalled).toBe(false)
    })

    it('TeacherRequestsPage appelle GET /teacher-requests (pas /teacher-requests/requests)', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestsPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/teacher-requests')
      })

      const allGetCalls = vi.mocked(mockApiClient.get).mock.calls
      const buggedUrlCalled = allGetCalls.some(
        (callArgs) => callArgs[0] === '/teacher-requests/requests',
      )
      expect(buggedUrlCalled).toBe(false)
    })

    it('TeacherRequestInbox (dans TeacherRequestPage rôle formateur) appelle GET /teacher-requests', async () => {
      // Pour tester l'inbox, on connecte un formateur
      mockUseAuth.mockReturnValue({
        user: {
          id: 'teacher-inbox-001',
          email: 'prof@test.com',
          role: 'formateur' as const,
          validationStatus: 'active' as const,
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        hasRole: vi.fn((...roles: string[]) => roles.includes('formateur')),
        isInternalRole: vi.fn(() => false),
      })

      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

      render(
        <MemoryRouter>
          <TeacherRequestPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        // L'inbox formateur appelle /teacher-requests
        expect(mockApiClient.get).toHaveBeenCalledWith('/teacher-requests')
      })

      const allGetCalls = vi.mocked(mockApiClient.get).mock.calls
      const buggedUrlCalled = allGetCalls.some(
        (callArgs) => callArgs[0] === '/teacher-requests/requests',
      )
      expect(buggedUrlCalled).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Création de demande — POST /teacher-requests (pas /teacher-requests/requests)
  // ─────────────────────────────────────────────────────────────────────────
  describe('4. Création de demande — POST /teacher-requests', () => {
    it('TeacherRequestsPage soumet POST /teacher-requests (pas /teacher-requests/requests)', async () => {
      const newRequest = {
        id: 'req-new-fix-001',
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        description: 'Aide en analyse niveau terminale',
      }

      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: newRequest })

      render(
        <MemoryRouter>
          <TeacherRequestsPage />
        </MemoryRouter>,
      )

      // Attendre que le bouton "Nouvelle demande" soit visible
      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle demande/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

      await userEvent.type(
        screen.getByPlaceholderText(/décrivez le besoin/i),
        'Aide en analyse niveau terminale',
      )

      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        // L'URL corrigée : /teacher-requests (et NON /teacher-requests/requests)
        expect(mockApiClient.post).toHaveBeenCalledWith('/teacher-requests', {
          description: 'Aide en analyse niveau terminale',
        })
      })
    })

    it('la nouvelle demande apparaît dans la liste après création via TeacherRequestsPage', async () => {
      const newRequest = {
        id: 'req-new-fix-002',
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        description: 'Cours de trigonométrie',
      }

      mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
      mockApiClient.post = vi.fn().mockResolvedValue({ data: newRequest })

      render(
        <MemoryRouter>
          <TeacherRequestsPage />
        </MemoryRouter>,
      )

      await waitFor(() => {
        screen.getByRole('button', { name: /nouvelle demande/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))
      await userEvent.type(
        screen.getByPlaceholderText(/décrivez le besoin/i),
        'Cours de trigonométrie',
      )
      await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

      await waitFor(() => {
        expect(screen.getByText('Cours de trigonométrie')).toBeDefined()
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Détail d'une demande — GET /teacher-requests/:id (pas /teacher-requests/requests/:id)
  // ─────────────────────────────────────────────────────────────────────────
  describe('5. Détail d\'une demande — URL correcte sans segment doublé', () => {
    const REQUEST_ID = 'req-detail-fix-001'

    function renderDetailPage() {
      return render(
        <MemoryRouter initialEntries={[`/teacher-requests/${REQUEST_ID}`]}>
          <Routes>
            <Route path="/teacher-requests/:requestId" element={<TeacherRequestDetailPage />} />
          </Routes>
        </MemoryRouter>,
      )
    }

    it('appelle GET /teacher-requests/:id (pas /teacher-requests/requests/:id)', async () => {
      const requestData = {
        id: REQUEST_ID,
        status: 'pending',
        createdAt: '2026-06-01T10:00:00Z',
        description: 'Demande de test pour vérification URL',
        studentId: STUDENT_USER.id,
        candidates: [],
      }

      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestData })

      renderDetailPage()

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith(`/teacher-requests/${REQUEST_ID}`)
      })

      // Vérification explicite : l'ancienne URL bugguée ne doit PAS être appelée
      const allGetCalls = vi.mocked(mockApiClient.get).mock.calls
      const buggedUrlCalled = allGetCalls.some(
        (callArgs) =>
          typeof callArgs[0] === 'string' &&
          callArgs[0].includes('/teacher-requests/requests/'),
      )
      expect(buggedUrlCalled).toBe(false)
    })

    it('affiche le détail de la demande chargée depuis GET /teacher-requests/:id', async () => {
      const requestData = {
        id: REQUEST_ID,
        status: 'pending',
        createdAt: '2026-06-01T10:00:00Z',
        description: 'Besoin aide en algèbre pour bac S',
        studentId: STUDENT_USER.id,
        candidates: [],
      }

      mockApiClient.get = vi.fn().mockResolvedValue({ data: requestData })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByText('Besoin aide en algèbre pour bac S')).toBeDefined()
      })
    })

    it('affiche une erreur 404 si la demande est introuvable (sans bug URL)', async () => {
      mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 404 } })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByText('Demande introuvable')).toBeDefined()
      })

      // La page ne doit pas afficher d'erreur liée à un mauvais endpoint
      expect(screen.queryByText(/mauvais endpoint/i)).toBeNull()
    })

    it('affiche "Accès refusé" sur erreur 403', async () => {
      mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 403 } })

      renderDetailPage()

      await waitFor(() => {
        expect(screen.getByText('Accès refusé')).toBeDefined()
      })
    })
  })
})
