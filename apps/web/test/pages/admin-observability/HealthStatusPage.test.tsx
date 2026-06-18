/**
 * Tests pour HealthStatusPage (Phase 15)
 *
 * Couvre :
 * - Le TI voit le rapport de santé des services
 * - Le RP peut accéder à la page de santé
 * - Affichage de l'état global et détail par service
 * - Un utilisateur sans rôle autorisé voit un message d'accès refusé
 * - Gestion d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchHealthStatus } from '../../../src/api/adminObservability'
import HealthStatusPage from '../../../src/pages/HealthStatusPage'
import type { HealthStatusReport } from '../../../src/api/adminObservability'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchHealthStatus = vi.mocked(fetchHealthStatus)

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HEALTH_REPORT: HealthStatusReport = {
  overallStatus: 'healthy',
  checkedAt: '2026-06-18T10:00:00Z',
  services: [
    {
      service: 'identity-access-service',
      status: 'healthy',
      responseTimeMs: 42,
      lastCheckedAt: '2026-06-18T10:00:00Z',
    },
    {
      service: 'finance-credit-service',
      status: 'degraded',
      responseTimeMs: 850,
      lastCheckedAt: '2026-06-18T10:00:00Z',
    },
  ],
}

const DEGRADED_REPORT: HealthStatusReport = {
  overallStatus: 'degraded',
  checkedAt: '2026-06-18T10:00:00Z',
  services: [
    { service: 'finance-credit-service', status: 'down', lastCheckedAt: '2026-06-18T10:00:00Z' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HealthStatusPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchHealthStatus.mockResolvedValue(HEALTH_REPORT)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HealthStatusPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchHealthStatus.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Vérification de l\'état des services…')).toBeDefined()
  })

  it('le TI voit le rapport de santé des services', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('État des services')).toBeDefined()
      expect(screen.getByText('identity-access-service')).toBeDefined()
      expect(screen.getByText('finance-credit-service')).toBeDefined()
    })
  })

  it('affiche l\'état global "Opérationnel"', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Opérationnel').length).toBeGreaterThan(0)
    })
  })

  it('affiche l\'état dégradé correctement', async () => {
    mockFetchHealthStatus.mockResolvedValue(DEGRADED_REPORT)
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Dégradé').length).toBeGreaterThan(0)
    })
  })

  it('affiche le temps de réponse des services', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/42 ms/)).toBeDefined()
    })
  })

  it('le RP peut accéder à la page de santé', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('État des services')).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/i)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchHealthStatus.mockRejectedValue(new Error('Network error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de récupérer l'état des services/i)).toBeDefined()
    })
  })
})
