/**
 * Tests for RegisterPage
 *
 * Covers:
 * - Form rendering (email, password, role selector)
 * - Successful registration calls POST /accounts and redirects to /login
 * - API error is displayed
 * - Loading state during submission
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RegisterPage from '../../src/pages/RegisterPage'

vi.mock('../../src/api/client')
import apiClient from '../../src/api/client'
const mockApiClient = vi.mocked(apiClient)

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RegisterPage', () => {
  it('renders the registration form fields', () => {
    renderRegisterPage()

    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/8 caractères minimum/i)).toBeDefined()
    expect(screen.getByRole('combobox')).toBeDefined()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeDefined()
  })

  it('renders the three selectable roles', () => {
    renderRegisterPage()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((opt) => opt.value)
    expect(optionValues).toContain('eleve')
    expect(optionValues).toContain('parent_financeur')
    expect(optionValues).toContain('formateur')
  })

  it('shows a link back to login page', () => {
    renderRegisterPage()
    expect(screen.getByRole('link', { name: /se connecter/i })).toBeDefined()
  })

  it('calls POST /accounts with the correct payload on submit', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderRegisterPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'new@student.com')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'formateur')
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', {
        email: 'new@student.com',
        password: 'password123',
        role: 'formateur',
      })
    })
  })

  it('redirects to /login after successful registration', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderRegisterPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'new@student.com')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('displays API error message on failure', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue({
      response: { data: { message: 'Email déjà utilisé' } },
    })

    renderRegisterPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'existing@student.com')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Email déjà utilisé')).toBeDefined()
    })
  })

  it('shows loading state during submission', async () => {
    let resolvePost!: () => void
    mockApiClient.post = vi.fn().mockImplementation(
      () => new Promise<{ data: object }>((resolve) => { resolvePost = () => resolve({ data: {} }) }),
    )

    renderRegisterPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'new@student.com')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /création/i })).toBeDefined()
    })

    resolvePost()
  })
})
