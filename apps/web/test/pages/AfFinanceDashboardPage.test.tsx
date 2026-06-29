/**
 * Tests pour AfFinanceDashboardPage (Phase 9)
 *
 * Couvre :
 * - Redirection vers /forbidden pour les non-AF
 * - Affichage des événements financiers
 * - Modification des paramètres de rémunération
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AfFinanceDashboardPage from '../../src/pages/AfFinanceDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

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

function buildAuthMock(userObj = AF_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

function renderAfDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin/finance']}>
      <Routes>
        <Route path="/admin/finance" element={<AfFinanceDashboardPage />} />
        <Route path="/forbidden" element={<div>Accès interdit</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_EVENTS = [
  {
    id: 'event-1',
    eventType: 'PaymentConfirmed',
    payload: { amount: 9900 },
    occurredAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'event-2',
    eventType: 'InvoiceIssued',
    payload: {},
    occurredAt: '2026-06-01T10:01:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('AfFinanceDashboardPage', () => {
  it('redirige vers /forbidden pour un non-AF', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderAfDashboard()

    await waitFor(() => {
      expect(screen.getByText('Accès interdit')).toBeDefined()
    })
  })

  it('affiche l\'en-tête pour un AF', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderAfDashboard()

    await waitFor(() => {
      expect(screen.getByText('Espace administrateur financier')).toBeDefined()
    })
  })

  it('affiche les événements financiers récents', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_EVENTS })

    renderAfDashboard()

    await waitFor(() => {
      expect(screen.getByText('PaymentConfirmed')).toBeDefined()
      expect(screen.getByText('InvoiceIssued')).toBeDefined()
    })
  })

  it('affiche "Aucun événement" si la liste est vide', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderAfDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucun événement financier récent.')).toBeDefined()
    })
  })

  it('affiche les paramètres de rémunération', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderAfDashboard()

    await waitFor(() => {
      expect(screen.getByText('Rémunération')).toBeDefined()
    })
  })

  it('l\'AF peut modifier les paramètres de rémunération', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })

    renderAfDashboard()

    await waitFor(() => {
      screen.getByText('Modifier')
    })

    await userEvent.click(screen.getByText('Modifier'))

    await waitFor(() => {
      screen.getByText('Enregistrer')
    })

    await userEvent.click(screen.getByText('Enregistrer'))

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/financial-settings/rewards',
        expect.objectContaining({ pointsPerEuro: expect.any(Number) }),
      )
    })
  })
})
