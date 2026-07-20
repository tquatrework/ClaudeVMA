/**
 * Tests for RecoverIdentifierPage
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
import RecoverIdentifierPage from '../../src/pages/RecoverIdentifierPage'

vi.mock('../../src/api/auth')
import { recoverIdentifier } from '../../src/api/auth'
const mockRecoverIdentifier = vi.mocked(recoverIdentifier)

function renderRecoverIdentifierPage() {
  return render(
    <MemoryRouter initialEntries={['/recover-identifier']}>
      <Routes>
        <Route path="/recover-identifier" element={<RecoverIdentifierPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RecoverIdentifierPage', () => {
  it('renders the email field and submit button', () => {
    renderRecoverIdentifierPage()

    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /récupérer mes identifiants/i })).toBeDefined()
  })

  it('renders a link back to the login page', () => {
    renderRecoverIdentifierPage()

    expect(screen.getByRole('link', { name: /retour à la connexion/i })).toBeDefined()
  })

  it('calls recoverIdentifier with the email on submit', async () => {
    mockRecoverIdentifier.mockResolvedValue(undefined)

    renderRecoverIdentifierPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /récupérer mes identifiants/i }))

    await waitFor(() => {
      expect(mockRecoverIdentifier).toHaveBeenCalledWith('user@test.com')
    })
  })

  it('shows confirmation message after successful request', async () => {
    mockRecoverIdentifier.mockResolvedValue(undefined)

    renderRecoverIdentifierPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /récupérer mes identifiants/i }))

    await waitFor(() => {
      expect(screen.getByText(/demande envoyée/i)).toBeDefined()
    })
  })

  it('displays API error message on failure', async () => {
    mockRecoverIdentifier.mockRejectedValue({
      response: { data: { message: 'Service temporairement indisponible' } },
    })

    renderRecoverIdentifierPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /récupérer mes identifiants/i }))

    await waitFor(() => {
      expect(screen.getByText('Service temporairement indisponible')).toBeDefined()
    })
  })

  it('displays a generic error message when API returns no message', async () => {
    mockRecoverIdentifier.mockRejectedValue(new Error('Network Error'))

    renderRecoverIdentifierPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /récupérer mes identifiants/i }))

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de la demande/i)).toBeDefined()
    })
  })

  it('disables the submit button while submitting', async () => {
    let resolveRequest!: () => void
    mockRecoverIdentifier.mockImplementation(
      () => new Promise<void>((resolve) => { resolveRequest = () => resolve(undefined) }),
    )

    renderRecoverIdentifierPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'user@test.com')
    await userEvent.click(screen.getByRole('button', { name: /récupérer mes identifiants/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /envoi/i }).hasAttribute('disabled')).toBe(true)
    })

    resolveRequest()
  })
})
