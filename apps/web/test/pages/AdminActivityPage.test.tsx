/**
 * Tests pour AdminActivityPage
 *
 * Couvre :
 * - Chargement / erreur / vide / succès des types de workflows disponibles
 * - Déclenchement d'un workflow (succès, payload JSON invalide, erreur backend)
 * - Bascule entre les onglets Workflows / Commandes / Événements
 *
 * Le contrôle d'accès par rôle est géré par <ProtectedRoute> dans App.tsx, pas par la page
 * elle-même : `useAuth` n'est mocké ici que parce que `Layout` (rendu par toutes les pages)
 * en dépend, pas pour une vérification de rôle propre à AdminActivityPage.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminActivityPage from '../../src/pages/AdminActivityPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/orchestration')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchWorkflowDefinitions, startWorkflow } from '../../src/api/orchestration'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchWorkflowDefinitions = vi.mocked(fetchWorkflowDefinitions)
const mockStartWorkflow = vi.mocked(startWorkflow)

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: TI_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(TI_USER.role)),
    isInternalRole: vi.fn(() => true),
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/activity']}>
      <Routes>
        <Route path="/admin/activity" element={<AdminActivityPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_DEFINITIONS = [
  { id: 'student-onboarding', name: 'Inscription élève', phase: 1, stepCount: 5 },
  { id: 'teacher-onboarding', name: 'Inscription formateur', phase: 1, stepCount: 4 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchWorkflowDefinitions.mockResolvedValue(SAMPLE_DEFINITIONS)
})

describe('AdminActivityPage', () => {
  it('affiche l\'en-tête et les onglets', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Activité interne')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'Workflows' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Commandes' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Événements' })).toBeDefined()
  })

  it('affiche les types de workflows disponibles après chargement', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Inscription élève')).toBeDefined()
      expect(screen.getByText(/5 étapes/)).toBeDefined()
    })
  })

  it('affiche "Aucun type de workflow disponible" si la liste est vide', async () => {
    mockFetchWorkflowDefinitions.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Aucun type de workflow disponible.')).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement des types de workflows échoue', async () => {
    mockFetchWorkflowDefinitions.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.'),
      ).toBeDefined()
    })
  })

  it('affiche "Aucune instance de workflow active" (aucune route de listing disponible)', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Aucune instance de workflow active')).toBeDefined()
    })
  })

  it('déclenche un workflow avec succès et affiche le résultat', async () => {
    mockStartWorkflow.mockResolvedValue({
      workflowInstanceId: 'wf-1',
      workflowType: 'student-onboarding',
      correlationId: 'corr-1',
      status: 'in_progress',
      startedAt: '2026-07-20T00:00:00.000Z',
    })

    renderPage()

    await waitFor(() => screen.getByText('Nouveau workflow'))
    await userEvent.click(screen.getByText('Nouveau workflow'))

    await waitFor(() => screen.getByRole('button', { name: /déclencher/i }))
    await userEvent.click(screen.getByRole('button', { name: /déclencher/i }))

    await waitFor(() => {
      expect(mockStartWorkflow).toHaveBeenCalledWith(
        'student-onboarding',
        expect.objectContaining({ workflowType: 'student-onboarding', payload: {} }),
      )
      expect(screen.getByText('Workflow démarré :')).toBeDefined()
      expect(screen.getByText(/wf-1/)).toBeDefined()
    })
  })

  it('affiche une erreur si le payload JSON est invalide', async () => {
    renderPage()

    await waitFor(() => screen.getByText('Nouveau workflow'))
    await userEvent.click(screen.getByText('Nouveau workflow'))

    const payloadField = await screen.findByRole('textbox')
    fireEvent.change(payloadField, { target: { value: '[invalide' } })

    await userEvent.click(screen.getByRole('button', { name: /déclencher/i }))

    await waitFor(() => {
      expect(screen.getByText('Le payload doit être un JSON valide')).toBeDefined()
    })
    expect(mockStartWorkflow).not.toHaveBeenCalled()
  })

  it('affiche une erreur backend si le déclenchement du workflow échoue', async () => {
    mockStartWorkflow.mockRejectedValue({
      response: { status: 400, data: { message: 'Type de workflow inconnu' } },
    })

    renderPage()

    await waitFor(() => screen.getByText('Nouveau workflow'))
    await userEvent.click(screen.getByText('Nouveau workflow'))

    await waitFor(() => screen.getByRole('button', { name: /déclencher/i }))
    await userEvent.click(screen.getByRole('button', { name: /déclencher/i }))

    await waitFor(() => {
      expect(screen.getByText('Type de workflow inconnu')).toBeDefined()
    })
  })

  it('bascule vers le panneau Commandes', async () => {
    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Commandes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Commandes' }))

    await waitFor(() => {
      expect(screen.getByText("Commande d'intégration")).toBeDefined()
    })
  })

  it('bascule vers le panneau Événements', async () => {
    renderPage()

    await waitFor(() => screen.getByRole('button', { name: 'Événements' }))
    await userEvent.click(screen.getByRole('button', { name: 'Événements' }))

    await waitFor(() => {
      expect(screen.getByText('Historique des événements')).toBeDefined()
    })
  })
})
