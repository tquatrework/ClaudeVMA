/**
 * Tests for AgreementsPage (FRONT-BR-009)
 *
 * Couvre :
 * - État de chargement
 * - Affichage de l'instance de workflow en attente d'arbitrage
 * - Erreur 404 ("Demande introuvable ou déjà traitée") et erreur générique
 * - Acceptation (resumeWorkflow) et refus (suspendWorkflow) tracés via orchestration-service
 * - Message générique en cas d'échec de la réponse
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AgreementsPage from '../../src/pages/AgreementsPage'

// AgreementsPage n'utilise pas useAuth lui-même, mais elle est rendue à l'intérieur de
// <Layout>, qui en dépend — nécessaire pour éviter l'erreur "must be used inside <AuthProvider>".
vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/orchestration')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchWorkflowArbitrationInstance,
  resumeWorkflow,
  suspendWorkflow,
} from '../../src/api/orchestration'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchWorkflowArbitrationInstance = vi.mocked(fetchWorkflowArbitrationInstance)
const mockResumeWorkflow = vi.mocked(resumeWorkflow)
const mockSuspendWorkflow = vi.mocked(suspendWorkflow)

const REQUEST_ID = 'wf-instance-arbitration-001'

const DEFAULT_USER = {
  id: 'user-1',
  email: 'user@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: DEFAULT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => false),
    isInternalRole: vi.fn(() => false),
  }
}

const INSTANCE = {
  workflowInstanceId: REQUEST_ID,
  status: 'needs_arbitration',
  reason: 'Changement de coordonnées bancaires',
}

function renderPage(requestId = REQUEST_ID) {
  return render(
    <MemoryRouter initialEntries={[`/agreements/${requestId}`]}>
      <Routes>
        <Route path="/agreements/:requestId" element={<AgreementsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchWorkflowArbitrationInstance.mockResolvedValue(INSTANCE)
})

describe('AgreementsPage', () => {
  it('shows loading state while fetching', () => {
    mockFetchWorkflowArbitrationInstance.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('displays the workflow instance identifier, reason and status', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(REQUEST_ID)).toBeDefined()
      expect(screen.getByText('Changement de coordonnées bancaires')).toBeDefined()
      expect(screen.getByText('needs_arbitration')).toBeDefined()
    })
  })

  it('shows "Demande introuvable ou déjà traitée" for a 404 error', async () => {
    mockFetchWorkflowArbitrationInstance.mockRejectedValue({ response: { status: 404 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Demande introuvable ou déjà traitée')).toBeDefined()
    })
  })

  it('shows a generic error message for other load failures', async () => {
    mockFetchWorkflowArbitrationInstance.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger la demande')).toBeDefined()
    })
  })

  it('accepts the agreement via resumeWorkflow and shows the confirmation', async () => {
    mockResumeWorkflow.mockResolvedValue({
      workflowInstanceId: REQUEST_ID,
      status: 'in_progress',
    })

    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /accepter/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockResumeWorkflow).toHaveBeenCalledWith(REQUEST_ID)
      expect(screen.getByText(/votre réponse a été enregistrée/i)).toBeDefined()
    })
  })

  it('refuses the agreement via suspendWorkflow with a fixed reason', async () => {
    mockSuspendWorkflow.mockResolvedValue({
      workflowInstanceId: REQUEST_ID,
      status: 'needs_arbitration',
      reason: "Refusé par l'utilisateur",
    })

    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /refuser/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockSuspendWorkflow).toHaveBeenCalledWith(REQUEST_ID, {
        reason: "Refusé par l'utilisateur",
      })
      expect(screen.getByText(/votre réponse a été enregistrée/i)).toBeDefined()
    })
  })

  it('shows a generic error message when responding fails', async () => {
    mockResumeWorkflow.mockRejectedValue(new Error('network error'))

    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /accepter/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du traitement de votre réponse')).toBeDefined()
    })
  })
})
