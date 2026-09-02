/**
 * RpUserDirectoryPage — `/rp/visualisation` (reconstruction du rail RP,
 * 2026-09-02).
 *
 * Onglet « Professeurs » : annuaire réel (`GET /profiles/teachers/validated`),
 * lien vers la fiche (`/profiles/:userId`), jamais l'UUID affiché comme
 * libellé. Onglets « Élèves », « Parents financeurs », « Animateurs
 * pédagogiques » : aucune route de liste n'existe côté serveur — état
 * explicite « fonctionnalité indisponible », jamais un écran vide muet.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RpUserDirectoryPage from '../../src/pages/RpUserDirectoryPage'

vi.mock('../../src/api/profile')
vi.mock('../../src/hooks/useAuth')

import { fetchValidatedTeachers } from '../../src/api/profile'
import { useAuth } from '../../src/hooks/useAuth'

const mockFetchValidatedTeachers = vi.mocked(fetchValidatedTeachers)
const mockUseAuth = vi.mocked(useAuth)

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  loginIdentifier: 'rp.test',
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: RP_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(RP_USER.role)),
    isInternalRole: vi.fn(() => true),
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RpUserDirectoryPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('RpUserDirectoryPage', () => {
  it('affiche les professeurs validés avec un lien vers leur fiche, jamais leur UUID en libellé', async () => {
    mockFetchValidatedTeachers.mockResolvedValue({
      data: [
        { userId: 'teacher-abc-123', firstName: 'Camille', lastName: 'Durand', levels: ['3e'], subjects: ['Algèbre'] },
      ],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Camille Durand')).toBeDefined()
    })

    expect(screen.queryByText('teacher-abc-123')).toBeNull()

    const link = screen.getByRole('link', { name: /Camille Durand/i })
    expect(link.getAttribute('href')).toBe('/profiles/teacher-abc-123')
  })

  it('affiche un état « indisponible » explicite pour l\'onglet Élèves (aucune route de liste)', async () => {
    mockFetchValidatedTeachers.mockResolvedValue({
      data: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun professeur validé/i)).toBeDefined()
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Élèves' }))

    expect(screen.getByText(/n'existe encore côté serveur/i)).toBeDefined()
  })

  it('affiche un état « indisponible » explicite pour les onglets Parents et Animateurs pédagogiques', async () => {
    mockFetchValidatedTeachers.mockResolvedValue({
      data: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Aucun professeur validé/i)).toBeDefined()
    })

    // Les panneaux déjà activés restent montés (masqués en CSS), voir Tabs.tsx —
    // on vérifie donc un compte croissant de messages « indisponible » plutôt
    // qu'un texte unique, qui échouerait dès le second onglet visité.
    await userEvent.click(screen.getByRole('tab', { name: 'Parents financeurs' }))
    expect(screen.getAllByText(/n'existe encore côté serveur/i).length).toBeGreaterThanOrEqual(1)

    await userEvent.click(screen.getByRole('tab', { name: 'Animateurs pédagogiques' }))
    expect(screen.getAllByText(/n'existe encore côté serveur/i).length).toBeGreaterThanOrEqual(2)
  })
})
