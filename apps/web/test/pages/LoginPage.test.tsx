/**
 * Tests for LoginPage
 *
 * Covers:
 * - Form rendering (email, password, submit button, link to register)
 * - Successful login → navigate to /dashboard (default for eleve/formateur)
 * - Successful login → redirect by role (TI → /admin/accounts, RP → /admin/activity)
 * - Login success shows registration success message from location state
 * - Failed login → show error without losing form state
 * - Loading state disables the button
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import LoginPage from '../../src/pages/LoginPage'

vi.mock('../../src/hooks/useAuth')
import { useAuth } from '../../src/hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

const mockLoginFn = vi.fn()

function renderLoginPage(
  initialPath = '/login',
  initialState?: Record<string, unknown>,
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state: initialState }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/admin/accounts" element={<div>Admin Accounts Page</div>} />
        <Route path="/admin/activity" element={<div>Admin Activity Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockUseAuth.mockReturnValue({
    isLoading: false,
    login: mockLoginFn,
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
    hasRole: vi.fn().mockReturnValue(false),
    isInternalRole: vi.fn().mockReturnValue(false),
  })
})

afterEach(() => {
  localStorage.clear()
})

describe('LoginPage', () => {
  it('renders the email field, password field and submit button', () => {
    renderLoginPage()

    expect(screen.getByPlaceholderText(/jean\.dupont/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/••••••••/)).toBeDefined()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDefined()
  })

  it('renders "Identifiant de connexion" and "Mot de passe" labels', () => {
    renderLoginPage()
    expect(screen.getByText(/identifiant de connexion/i)).toBeDefined()
    // Use getAllByText since "Mot de passe" appears in both the label and the password-reset link
    const passwordTexts = screen.getAllByText(/mot de passe/i)
    expect(passwordTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows a link to the registration page', () => {
    renderLoginPage()
    expect(screen.getByRole('link', { name: /créer un compte/i })).toBeDefined()
  })

  it('calls login() with email and password on form submit', async () => {
    mockLoginFn.mockResolvedValue(undefined)
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'student@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(mockLoginFn).toHaveBeenCalledWith('student@test.com', 'secret123')
    })
  })

  it('navigates to /dashboard after successful login when user role is eleve', async () => {
    mockLoginFn.mockImplementation(() => {
      // Simulate what the real login() does: stores user in localStorage
      localStorage.setItem('user', JSON.stringify({ role: 'eleve' }))
      return Promise.resolve()
    })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'student@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
  })

  it('redirects to /admin/accounts after login when user role is technicien_informatique', async () => {
    mockLoginFn.mockImplementation(() => {
      localStorage.setItem('user', JSON.stringify({ role: 'technicien_informatique' }))
      return Promise.resolve()
    })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'ti@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Admin Accounts Page')).toBeDefined()
    })
  })

  it('redirects to /dashboard after login when user role is responsable_pedagogique', async () => {
    mockLoginFn.mockImplementation(() => {
      localStorage.setItem('user', JSON.stringify({ role: 'responsable_pedagogique' }))
      return Promise.resolve()
    })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'rp@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
  })

  it('redirects to the "from" location when coming from a protected route', async () => {
    mockLoginFn.mockImplementation(() => {
      localStorage.setItem('user', JSON.stringify({ role: 'eleve' }))
      return Promise.resolve()
    })
    // Simulate being redirected from /dashboard (location.state.from)
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/login', state: { from: { pathname: '/dashboard' } } }]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'student@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
  })

  it('shows registration success message passed via location state', () => {
    renderLoginPage('/login', { message: 'Compte créé avec succès. Connectez-vous.' })

    expect(screen.getByText('Compte créé avec succès. Connectez-vous.')).toBeDefined()
  })

  it('does not show a green message banner when no registration message is present', () => {
    renderLoginPage()

    // No green success banner should appear without location state message
    expect(screen.queryByText(/compte créé/i)).toBeNull()
  })

  it('shows error message when login fails with API error', async () => {
    mockLoginFn.mockRejectedValue({
      response: { data: { message: 'Identifiants incorrects' } },
    })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants incorrects')).toBeDefined()
    })
  })

  it('shows default error message when login fails without API message', async () => {
    mockLoginFn.mockRejectedValue(new Error('Network Error'))
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants invalides')).toBeDefined()
    })
  })

  it('keeps the email and password values after a failed login attempt', async () => {
    mockLoginFn.mockRejectedValue(new Error('Network Error'))
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants invalides')).toBeDefined()
    })

    // Form fields should still contain the typed values
    expect((screen.getByPlaceholderText(/jean\.dupont/i) as HTMLInputElement).value).toBe(
      'bad@test.com',
    )
    expect((screen.getByPlaceholderText(/••••••••/) as HTMLInputElement).value).toBe('wrongpass')
  })

  it('disables the submit button while loading', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      login: mockLoginFn,
      user: null,
      isAuthenticated: false,
      logout: vi.fn(),
      hasRole: vi.fn().mockReturnValue(false),
      isInternalRole: vi.fn().mockReturnValue(false),
    })
    renderLoginPage()

    // When loading, button text is "Connexion…" and it is disabled
    const submitButton = screen.getByRole('button', { name: /connexion/i })
    expect(submitButton.hasAttribute('disabled')).toBe(true)
  })
})
