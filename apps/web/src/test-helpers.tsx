/**
 * Shared test helpers for VisioMath frontend.
 *
 * Provides:
 * - `renderWithProviders`: wraps a component in AuthContext + MemoryRouter
 * - `mockAuthUser`: build a typed AuthUser fixture
 * - `makeApiError`: build an axios-shaped rejection to mock `src/api/*` failures
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
// API error mock helper
// ------------------------------------------------------------------

interface MockApiError {
  response: {
    status: number
    data?: { message: string }
  }
}

/**
 * Construit une erreur de forme axios (`{ response: { status, data } }`) pour simuler, dans un
 * test, le rejet d'un appel `src/api/*` — cohérent avec le mapping statut → message de
 * `getErrorMessage` (`src/utils/apiError.ts`).
 *
 * Exemple : `vi.mocked(fetchExercises).mockRejectedValueOnce(makeApiError(403))`
 */
export function makeApiError(status: number, message?: string): MockApiError {
  return {
    response: {
      status,
      ...(message ? { data: { message } } : {}),
    },
  }
}

// ------------------------------------------------------------------
// Garde-fou UX : aucun identifiant technique à l'écran
// ------------------------------------------------------------------

/**
 * Détecte un UUID v4 canonique (8-4-4-4-12) dans un texte.
 * Volontairement insensible à la casse et non ancré : on cherche un UUID
 * *n'importe où* dans le rendu, y compris au milieu d'une phrase.
 */
export const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Assertion de non-régression sur la règle UX du projet : « les UUID peuvent être
 * utilisés dans les URLs, les appels API, les logs ou les clés React, mais pas comme
 * libellé principal à l'écran ».
 *
 * Vérifie le texte visible (`textContent`) d'un conteneur — les attributs `key`,
 * `href` ou `data-*` ne sont pas concernés, seul ce que lit l'utilisateur l'est.
 */
export function expectNoTechnicalIdentifier(container: HTMLElement): void {
  const visibleText = container.textContent ?? ''
  const match = visibleText.match(UUID_PATTERN)
  if (match) {
    throw new Error(
      `Un identifiant technique (UUID) est affiché à l'écran : "${match[0]}".\n` +
        `Règle UX VisioMath : afficher un nom humain ou un repli lisible, jamais un UUID.\n` +
        `Texte rendu : ${visibleText}`,
    )
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
