/**
 * Tests for LoginPage
 *
 * Covers:
 * - Form rendering (email, password, submit button, link to register)
 * - Successful login → navigate to /dashboard
 * - Failed login → show error message
 * - Loading state disables the button
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from '../../src/pages/LoginPage'

vi.mock('../../src/hooks/useAuth')
import { useAuth } from '../../src/hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

const mockLoginFn = vi.fn()

function renderLoginPage(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
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

describe('LoginPage', () => {
  it('renders the email field, password field and submit button', () => {
    renderLoginPage()

    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/••••••••/)).toBeDefined()
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDefined()
  })

  it('renders "Adresse e-mail" and "Mot de passe" labels', () => {
    renderLoginPage()
    expect(screen.getByText(/adresse e-mail/i)).toBeDefined()
    expect(screen.getByText(/mot de passe/i)).toBeDefined()
  })

  it('shows a link to the registration page', () => {
    renderLoginPage()
    expect(screen.getByRole('link', { name: /créer un compte/i })).toBeDefined()
  })

  it('calls login() with email and password on form submit', async () => {
    mockLoginFn.mockResolvedValue(undefined)
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'student@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(mockLoginFn).toHaveBeenCalledWith('student@test.com', 'secret123')
    })
  })

  it('navigates to /dashboard after successful login', async () => {
    mockLoginFn.mockResolvedValue(undefined)
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'student@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
  })

  it('shows error message when login fails with API error', async () => {
    mockLoginFn.mockRejectedValue({
      response: { data: { message: 'Identifiants incorrects' } },
    })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants incorrects')).toBeDefined()
    })
  })

  it('shows default error message when login fails without API message', async () => {
    mockLoginFn.mockRejectedValue(new Error('Network Error'))
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    await waitFor(() => {
      expect(screen.getByText('Identifiants invalides')).toBeDefined()
    })
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
