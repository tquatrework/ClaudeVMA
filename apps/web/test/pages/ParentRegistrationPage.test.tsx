/**
 * Tests for ParentRegistrationPage
 *
 * Covers:
 * - Form rendering (email, password, confirmPassword)
 * - Password mismatch validation
 * - Password too short validation
 * - Successful registration calls POST /accounts/parents and redirects to /login
 * - API error displayed in form
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentRegistrationPage from '../../src/pages/ParentRegistrationPage'

vi.mock('../../src/api/client')
import apiClient from '../../src/api/client'
const mockApiClient = vi.mocked(apiClient)

function renderParentRegistrationPage() {
  return render(
    <MemoryRouter initialEntries={['/register/parent']}>
      <Routes>
        <Route path="/register/parent" element={<ParentRegistrationPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillForm(options: { password?: string; confirmPassword?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'parent@test.com')
  await userEvent.type(
    screen.getByPlaceholderText(/8 caractères minimum/i),
    options.password ?? 'password123',
  )
  await userEvent.type(
    screen.getByPlaceholderText(/répétez le mot de passe/i),
    options.confirmPassword ?? 'password123',
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ParentRegistrationPage', () => {
  it('renders the title and all form fields', () => {
    renderParentRegistrationPage()

    expect(screen.getByText(/créer un compte parent \/ financeur/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/8 caractères minimum/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/répétez le mot de passe/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeDefined()
  })

  it('shows error when passwords do not match', async () => {
    renderParentRegistrationPage()

    await fillForm({ password: 'password123', confirmPassword: 'different456' })
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/mots de passe ne correspondent pas/i)).toBeDefined()
    })
  })

  it('shows error when password is too short', async () => {
    renderParentRegistrationPage()

    await fillForm({ password: 'court', confirmPassword: 'court' })
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/au moins 8 caractères/i)).toBeDefined()
    })
  })

  it('calls POST /accounts with correct payload on valid submit', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/accounts/parents', {
        email: 'parent@test.com',
        password: 'password123',
      })
    })
  })

  it('redirects to /login after successful registration', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('displays API error message on submission failure', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue({
      response: { data: { message: 'Email déjà utilisé' } },
    })
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Email déjà utilisé')).toBeDefined()
    })
  })

  it('displays a generic error message when API response has no message', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue(new Error('Network error'))
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de la création du compte/i)).toBeDefined()
    })
  })
})
