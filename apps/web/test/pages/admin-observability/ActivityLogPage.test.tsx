/**
 * Tests pour ActivityLogPage (Phase 15)
 *
 * Couvre :
 * - Le TI voit les logs d'activité et peut filtrer
 * - Le RP voit les logs d'activité
 * - Un utilisateur sans rôle autorisé voit un message d'accès refusé
 * - État vide et état d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchActivityLog } from '../../../src/api/adminObservability'
import ActivityLogPage from '../../../src/pages/ActivityLogPage'
import type { ActivityLogEntry } from '../../../src/api/adminObservability'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchActivityLog = vi.mocked(fetchActivityLog)

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

// ─── Fixtures logs ────────────────────────────────────────────────────────────

const LOG_ENTRY: ActivityLogEntry = {
  id: 'log-1',
  userId: 'user-abc',
  userEmail: 'user@test.com',
  userRole: 'eleve',
  action: 'login',
  targetResource: 'session',
  targetId: 'session-42',
  occurredAt: '2026-06-18T09:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ActivityLogPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchActivityLog.mockResolvedValue([])
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityLogPage', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchActivityLog.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement des logs d\'activité…')).toBeDefined()
  })

  it('le TI voit les logs d\'activité', async () => {
    mockFetchActivityLog.mockResolvedValue([LOG_ENTRY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeDefined()
      expect(screen.getByText('login')).toBeDefined()
    })
  })

  it('affiche "Aucun log d\'activité trouvé" quand la liste est vide', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun log d'activité trouvé/)).toBeDefined()
    })
  })

  it('le RP voit les logs d\'activité', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchActivityLog.mockResolvedValue([LOG_ENTRY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('user@test.com')).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchActivityLog.mockRejectedValue(new Error('Server error'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les logs d'activité/)).toBeDefined()
    })
  })

  it('le TI peut filtrer les logs par action', async () => {
    mockFetchActivityLog.mockResolvedValue([LOG_ENTRY])
    renderPage()

    await waitFor(() => {
      screen.getByLabelText(/Action/i)
    })

    await userEvent.type(screen.getByLabelText(/Action/i), 'login')
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/i }))

    await waitFor(() => {
      expect(mockFetchActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login' }),
      )
    })
  })

  it('le TI peut réinitialiser les filtres', async () => {
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /Réinitialiser/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/i }))

    await waitFor(() => {
      expect(mockFetchActivityLog).toHaveBeenCalledTimes(2)
    })
  })
})
