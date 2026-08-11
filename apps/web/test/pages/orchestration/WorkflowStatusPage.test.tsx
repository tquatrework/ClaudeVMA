/**
 * Tests pour WorkflowStatusPage (Phase 16)
 *
 * Couvre :
 * - Affichage de l'état de chargement
 * - Liste vide après chargement
 * - Affichage des types de workflows disponibles
 * - Accès refusé pour un élève
 * - TI, RP et AF peuvent accéder à la page
 * - Gestion d'erreur de chargement
 * - Le formulaire de recherche d'instance est présent
 *
 * Le titre de la page est cherché par son rôle ARIA (`heading`) et non par son
 * texte : les rails gauches de l'AF et du TI portent une entrée « Workflows »
 * qui mène ici, si bien qu'un `getByText` trouvait deux nœuds et échouait — pour
 * l'AF seulement, le RP n'ayant pas cette entrée. C'était la requête qui était
 * trop lâche, pas l'écran.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/orchestration')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchWorkflowDefinitions } from '../../../src/api/orchestration'
import WorkflowStatusPage from '../../../src/pages/WorkflowStatusPage'
import type { WorkflowDefinition } from '../../../src/api/orchestration'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchWorkflowDefinitions = vi.mocked(fetchWorkflowDefinitions)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const AF_USER = {
  id: 'af-1',
  email: 'af@test.com',
  role: 'administrateur_financier' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TI_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

// ─── Fixtures workflows ───────────────────────────────────────────────────────

const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  { id: 'student-onboarding', name: 'Inscription élève', phase: 1, stepCount: 5 },
  { id: 'teacher-onboarding', name: 'Inscription formateur', phase: 1, stepCount: 5 },
  { id: 'teacher-request-to-assignment', name: 'Demande professeur → Affectation', phase: 1, stepCount: 7 },
  { id: 'scheduled-video-course', name: 'Cours en visio planifié', phase: 1, stepCount: 6 },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkflowStatusPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchWorkflowDefinitions.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkflowStatusPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchWorkflowDefinitions.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Chargement des workflows disponibles/)).toBeDefined()
  })

  it('affiche "Aucun workflow disponible" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun workflow disponible/)).toBeDefined()
    })
  })

  it('affiche les types de workflows disponibles', async () => {
    mockFetchWorkflowDefinitions.mockResolvedValue(WORKFLOW_DEFINITIONS)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Inscription élève')).toBeDefined()
      expect(screen.getByText('Inscription formateur')).toBeDefined()
    })
  })

  it('affiche le nombre d\'étapes pour chaque workflow', async () => {
    mockFetchWorkflowDefinitions.mockResolvedValue([WORKFLOW_DEFINITIONS[0]])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/5 étapes/)).toBeDefined()
    })
  })

  it('affiche un champ de recherche d\'instance', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByLabelText(/Identifiant d'instance/)).toBeDefined()
    })
  })

  it('un élève voit un message d\'accès refusé', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
  })

  it('un RP peut accéder à la page', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Workflows' })).toBeDefined()
    })
  })

  it('un AF peut accéder à la page', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AF_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Workflows' })).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchWorkflowDefinitions.mockRejectedValue(new Error('Server error'))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les workflows disponibles/)).toBeDefined()
    })
  })

  it('le bouton "Actualiser" recharge les workflows', async () => {
    mockFetchWorkflowDefinitions.mockResolvedValue(WORKFLOW_DEFINITIONS)
    renderPage()

    await waitFor(() => {
      screen.getByText('Inscription élève')
    })

    await userEvent.click(screen.getByRole('button', { name: /actualiser/i }))

    await waitFor(() => {
      expect(mockFetchWorkflowDefinitions).toHaveBeenCalledTimes(2)
    })
  })
})
