/**
 * Tests for DashboardPage
 *
 * DashboardPage est un routeur de rôle pur : il lit le rôle
 * de l'utilisateur connecté et redirige vers le dashboard dédié.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '../../src/pages/DashboardPage'

vi.mock('../../src/hooks/useAuth')

import { useAuth } from '../../src/hooks/useAuth'

const mockUseAuth = vi.mocked(useAuth)

function buildAuthMock(role: string | null, isLoading = false) {
  const user = role
    ? { id: 'u-1', email: `${role}@test.com`, loginIdentifier: `${role}@test.com`, role, validationStatus: 'active' }
    : null
  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(role ?? '')),
    isInternalRole: vi.fn(() => false),
  }
}

function renderWithRoutes(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/eleve" element={<div>Dashboard Élève</div>} />
        <Route path="/dashboard/parent" element={<div>Dashboard Parent</div>} />
        <Route path="/dashboard/professeur" element={<div>Dashboard Professeur</div>} />
        <Route path="/dashboard/rp" element={<div>Dashboard RP</div>} />
        <Route path="/dashboard/ap" element={<div>Dashboard AP</div>} />
        <Route path="/admin/finance" element={<div>Dashboard AF</div>} />
        <Route path="/admin/observability" element={<div>Dashboard TI</div>} />
        <Route path="/login" element={<div>Page de connexion</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardPage — routeur de rôle', () => {
  it('affiche un état de chargement', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(null, true) as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText(/chargement/i)).toBeDefined()
  })

  it('redirige vers /login si non authentifié', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(null) as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Page de connexion')).toBeDefined()
  })

  it('redirige un élève vers /dashboard/eleve', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('eleve') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard Élève')).toBeDefined()
  })

  it('redirige un parent_financeur vers /dashboard/parent', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('parent_financeur') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard Parent')).toBeDefined()
  })

  it('redirige un formateur vers /dashboard/professeur', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('formateur') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard Professeur')).toBeDefined()
  })

  it('redirige un responsable_pedagogique vers /dashboard/rp', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('responsable_pedagogique') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard RP')).toBeDefined()
  })

  it('redirige un animateur_pedagogique vers /dashboard/ap', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('animateur_pedagogique') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard AP')).toBeDefined()
  })

  it('redirige un administrateur_financier vers /admin/finance', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('administrateur_financier') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard AF')).toBeDefined()
  })

  it('redirige un technicien_informatique vers /admin/observability', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('technicien_informatique') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard TI')).toBeDefined()
  })

  it('redirige un rôle inconnu vers /dashboard/eleve (fallback)', () => {
    mockUseAuth.mockReturnValue(buildAuthMock('role_inconnu') as ReturnType<typeof useAuth>)
    renderWithRoutes()
    expect(screen.getByText('Dashboard Élève')).toBeDefined()
  })
})
