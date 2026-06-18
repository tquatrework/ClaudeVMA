/**
 * Tests pour TechnicalLogsPage (Phase 15)
 *
 * Couvre :
 * - Le TI voit les logs techniques et peut les filtrer
 * - Logs expandables (stack trace)
 * - Un utilisateur sans rôle TI voit un message d'accès refusé
 * - État vide et état d'erreur
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchTechnicalLogs } from '../../../src/api/adminObservability'
import TechnicalLogsPage from '../../../src/pages/TechnicalLogsPage'
import type { TechnicalLogEntry } from '../../../src/api/adminObservability'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTechnicalLogs = vi.mocked(fetchTechnicalLogs)

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

// ─── Fixtures logs ────────────────────────────────────────────────────────────

const ERROR_LOG: TechnicalLogEntry = {
  id: 'tech-log-1',
  level: 'error',
  service: 'identity-access-service',
  message: 'JWT validation failed: token expired',
  traceId: 'trace-abc',
  stackTrace: 'Error: token expired\n  at validate (/app/auth.js:42)',
  occurredAt: '2026-06-18T09:00:00Z',
}

const INFO_LOG: TechnicalLogEntry = {
  id: 'tech-log-2',
  level: 'info',
  service: 'profile-service',
  message: 'Profile updated successfully',
  occurredAt: '2026-06-18T09:30:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TechnicalLogsPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchTechnicalLogs.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TechnicalLogsPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchTechnicalLogs.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des logs techniques…')).toBeDefined()
  })

  it('le TI voit les logs techniques', async () => {
    mockFetchTechnicalLogs.mockResolvedValue([ERROR_LOG, INFO_LOG])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('JWT validation failed: token expired')).toBeDefined()
      expect(screen.getByText('Profile updated successfully')).toBeDefined()
    })
  })

  it('affiche "Aucun log technique trouvé" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun log technique trouvé/)).toBeDefined()
    })
  })

  it('affiche le badge de niveau de log', async () => {
    mockFetchTechnicalLogs.mockResolvedValue([ERROR_LOG])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('ERROR')).toBeDefined()
    })
  })

  it('affiche le nom du service', async () => {
    mockFetchTechnicalLogs.mockResolvedValue([ERROR_LOG])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('identity-access-service')).toBeDefined()
    })
  })

  it('le TI peut expand un log pour voir la stack trace', async () => {
    mockFetchTechnicalLogs.mockResolvedValue([ERROR_LOG])
    renderPage()

    await waitFor(() => {
      screen.getByText('JWT validation failed: token expired')
    })

    await userEvent.click(screen.getByText('JWT validation failed: token expired'))

    await waitFor(() => {
      expect(screen.getByText(/Stack trace/i)).toBeDefined()
      expect(screen.getAllByText(/token expired/).length).toBeGreaterThan(0)
    })
  })

  it('le TI peut filtrer par niveau de log', async () => {
    mockFetchTechnicalLogs.mockResolvedValue([ERROR_LOG])
    renderPage()

    await waitFor(() => {
      screen.getByLabelText(/Niveau/i)
    })

    await userEvent.selectOptions(screen.getByLabelText(/Niveau/i), 'error')
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/i }))

    await waitFor(() => {
      expect(mockFetchTechnicalLogs).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' }),
      )
    })
  })

  it('affiche un message d\'accès refusé pour un RP (TI uniquement)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/i)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchTechnicalLogs.mockRejectedValue(new Error('Server error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les logs techniques/i)).toBeDefined()
    })
  })
})
