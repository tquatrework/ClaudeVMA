/**
 * Tests for PasswordResetPage
 *
 * Covers:
 * - Form rendering (email field, submit button, link back to login)
 * - Successful request shows confirmation message
 * - API error is displayed
 * - Loading state during submission
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PasswordResetPage from '../../src/pages/PasswordResetPage'

vi.mock('../../src/api/client')
import apiClient from '../../src/api/client'
const mockApiClient = vi.mocked(apiClient)

function renderPasswordResetPage() {
  return render(
    <MemoryRouter initialEntries={['/password-reset']}>
      <Routes>
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PasswordResetPage', () => {
  it('renders the email field and submit button', () => {
    renderPasswordResetPage()

    expect(screen.getByPlaceholderText(/jean\.dupont/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /envoyer le lien/i })).toBeDefined()
  })

  it('renders a link back to the login page', () => {
    renderPasswordResetPage()

    expect(screen.getByRole('link', { name: /retour à la connexion/i })).toBeDefined()
  })

  it('calls POST /auth/password-reset/request with the loginIdentifier on submit', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/password-reset/request', {
        loginIdentifier: 'user.test',
      })
    })
  })

  it('shows confirmation message after successful request', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/e-mail envoyé/i)).toBeDefined()
    })
  })

  it('shows a confirmation message after submitting', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'jean.dupont')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/lien de réinitialisation/i)).toBeDefined()
    })
  })

  it('displays API error message on failure', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue({
      response: { data: { message: 'Service temporairement indisponible' } },
    })

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText('Service temporairement indisponible')).toBeDefined()
    })
  })

  it('displays a generic error message when API returns no message', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue(new Error('Network Error'))

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de la demande/i)).toBeDefined()
    })
  })

  it('disables the submit button while submitting', async () => {
    let resolvePost!: () => void
    mockApiClient.post = vi.fn().mockImplementation(
      () => new Promise<{ data: object }>((resolve) => { resolvePost = () => resolve({ data: {} }) }),
    )

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /envoi/i }).hasAttribute('disabled')).toBe(true)
    })

    resolvePost()
  })
})
