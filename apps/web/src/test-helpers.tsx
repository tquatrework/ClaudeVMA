/**
 * Shared test helpers for VisioMath frontend.
 *
 * Provides:
 * - `renderWithProviders`: wraps a component in AuthContext + MemoryRouter
 * - `mockAuthUser`: build a typed AuthUser fixture
 * - Vitest mock for `../hooks/useAuth` — import and configure per test
 */

import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { vi } from 'vitest'
import type { AuthUser, UserRole } from './context/AuthContext'

// ------------------------------------------------------------------
// Auth mock helpers
// ------------------------------------------------------------------

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    loginIdentifier: 'test.user',
    email: 'test@example.com',
    role: 'eleve' as UserRole,
    validationStatus: 'active',
    ...overrides,
  }
}

export function makeUseAuthReturn(userOverrides: Partial<AuthUser> = {}, authOverrides: object = {}) {
  const user = makeAuthUser(userOverrides)
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: UserRole[]) => roles.includes(user.role)),
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as UserRole[]).includes(user.role),
    ),
    ...authOverrides,
  }
}

// ------------------------------------------------------------------
// Render with MemoryRouter
// ------------------------------------------------------------------

interface RenderWithRouterOptions extends RenderOptions {
  initialEntries?: MemoryRouterProps['initialEntries']
  initialIndex?: number
}

export function renderWithRouter(
  ui: React.ReactElement,
  { initialEntries = ['/'], ...options }: RenderWithRouterOptions = {},
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>,
    options,
  )
}
