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

vi.mock('../../src/api/auth')
import { requestPasswordReset } from '../../src/api/auth'
const mockRequestPasswordReset = vi.mocked(requestPasswordReset)

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

  it('calls requestPasswordReset with the loginIdentifier on submit', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined)

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('user.test')
    })
  })

  it('shows confirmation message after successful request', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined)

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/e-mail envoyé/i)).toBeDefined()
    })
  })

  it('shows a confirmation message after submitting', async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined)

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'jean.dupont')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/lien de réinitialisation/i)).toBeDefined()
    })
  })

  it('displays API error message on failure', async () => {
    mockRequestPasswordReset.mockRejectedValue({
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
    mockRequestPasswordReset.mockRejectedValue(new Error('Network Error'))

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de la demande/i)).toBeDefined()
    })
  })

  it('disables the submit button while submitting', async () => {
    let resolveRequest!: () => void
    mockRequestPasswordReset.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRequest = () => resolve(undefined) }),
    )

    renderPasswordResetPage()

    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'user.test')
    await userEvent.click(screen.getByRole('button', { name: /envoyer le lien/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /envoi/i }).hasAttribute('disabled')).toBe(true)
    })

    resolveRequest()
  })
})
