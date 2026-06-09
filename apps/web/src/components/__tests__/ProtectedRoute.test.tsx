import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProtectedRoute from '../ProtectedRoute'

// Mock useAuth
vi.mock('../../hooks/useAuth')

import { useAuth } from '../../hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

function renderWithRouter(
  ui: React.ReactElement,
  { initialEntry = '/' }: { initialEntry?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/forbidden" element={<div>Forbidden Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn().mockReturnValue(false),
      isInternalRole: vi.fn().mockReturnValue(false),
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Login Page')).toBeDefined()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@test.com', role: 'eleve', validationStatus: 'active' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn().mockReturnValue(true),
      isInternalRole: vi.fn().mockReturnValue(false),
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Protected Content')).toBeDefined()
  })

  it('redirects to /forbidden when role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', email: 'test@test.com', role: 'eleve', validationStatus: 'active' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn().mockReturnValue(false),
      isInternalRole: vi.fn().mockReturnValue(false),
    })

    renderWithRouter(
      <ProtectedRoute allowedRoles={['responsable_pedagogique']}>
        <div>Admin Content</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Forbidden Page')).toBeDefined()
    expect(screen.queryByText('Admin Content')).toBeNull()
  })
})
