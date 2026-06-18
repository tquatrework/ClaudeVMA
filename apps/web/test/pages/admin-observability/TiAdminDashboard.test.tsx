/**
 * Tests pour TiAdminDashboard (Phase 15)
 *
 * Couvre :
 * - Le TI voit le tableau de bord admin avec les liens de navigation rapide
 * - Le TI voit le résumé de santé de l'infrastructure
 * - Un utilisateur sans rôle autorisé voit un message d'accès refusé
 * - Un RP peut accéder au tableau de bord
 * - État de chargement de la santé
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchHealthStatus } from '../../../src/api/adminObservability'
import TiAdminDashboard from '../../../src/pages/TiAdminDashboard'
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
    { service: 'identity-access-service', status: 'healthy', lastCheckedAt: '2026-06-18T10:00:00Z' },
    { service: 'profile-service', status: 'healthy', lastCheckedAt: '2026-06-18T10:00:00Z' },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TiAdminDashboard />
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

describe('TiAdminDashboard', () => {
  it('affiche le titre du tableau de bord admin pour le TI', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Administration technique')).toBeDefined()
    })
  })

  it('affiche les liens de navigation rapide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Logs d\'activité')).toBeDefined()
      expect(screen.getByText('Logs techniques')).toBeDefined()
      expect(screen.getByText('Masquages temporaires')).toBeDefined()
      expect(screen.getByText('État des services')).toBeDefined()
      expect(screen.getByText('Métadonnées du site')).toBeDefined()
    })
  })

  it('affiche l\'état global de santé de l\'infrastructure', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getAllByText('Opérationnel').length).toBeGreaterThan(0)
    })
  })

  it('affiche les services de santé individuels', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('identity-access-service')).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
    })
  })

  it('le RP peut accéder au tableau de bord', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Administration technique')).toBeDefined()
    })
  })

  it('affiche "Vérification en cours" pendant le chargement de la santé', () => {
    mockFetchHealthStatus.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Vérification en cours…')).toBeDefined()
  })
})
