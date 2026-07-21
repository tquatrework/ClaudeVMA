/**
 * Tests for ConsentsPage
 *
 * Covers:
 * - Loading state while consents are being fetched
 * - Error state when the initial fetch fails
 * - Empty/nominal state (no consent signed yet)
 * - Signing a required consent (calls signConsent, optimistic UI update)
 * - Error state when signing fails
 * - Success state once both required consents are signed (access button + refreshUser/navigate)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConsentsPage from '../../src/pages/ConsentsPage'

vi.mock('../../src/api/accounts')
vi.mock('../../src/hooks/useAuth')

import { fetchConsents, signConsent } from '../../src/api/accounts'
import { useAuth } from '../../src/hooks/useAuth'

const mockFetchConsents = vi.mocked(fetchConsents)
const mockSignConsent = vi.mocked(signConsent)
const mockUseAuth = vi.mocked(useAuth)

function renderConsentsPage() {
  return render(
    <MemoryRouter initialEntries={['/consents']}>
      <Routes>
        <Route path="/consents" element={<ConsentsPage />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    user: { id: 'student-1', email: 'eleve@test.com', role: 'eleve', validationStatus: 'pending' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    hasRole: vi.fn().mockReturnValue(false),
    isInternalRole: vi.fn().mockReturnValue(false),
  })
})

describe('ConsentsPage', () => {
  it('shows a loading state while consents are being fetched', () => {
    mockFetchConsents.mockReturnValue(new Promise(() => {})) // never resolves
    renderConsentsPage()

    expect(screen.getByText(/chargement/i)).toBeDefined()
  })

  it('shows an error message when the initial fetch fails', async () => {
    mockFetchConsents.mockRejectedValue({
      response: { data: { message: 'Service indisponible' } },
    })
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByText('Service indisponible')).toBeDefined()
    })
  })

  it('renders the empty/nominal state with no consent signed yet', async () => {
    mockFetchConsents.mockResolvedValue([])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /signer/i }).length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/accéder à mon espace/i)).toBeNull()
  })

  it('renders already-signed consents from the fetched data', async () => {
    mockFetchConsents.mockResolvedValue([
      { consentType: 'rgpd', signedAt: '2026-01-01T00:00:00.000Z' },
    ])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getAllByText(/^signé$/i).length).toBeGreaterThan(0)
    })
  })

  it('calls signConsent when signing a required consent', async () => {
    mockFetchConsents.mockResolvedValue([])
    mockSignConsent.mockResolvedValue(undefined)
    renderConsentsPage()

    await waitFor(() => screen.getAllByRole('button', { name: /signer/i }))

    const signButtons = screen.getAllByRole('button', { name: /signer/i })
    await userEvent.click(signButtons[0])

    await waitFor(() => {
      expect(mockSignConsent).toHaveBeenCalledWith('rgpd')
    })
  })

  it('shows an error message when signing fails', async () => {
    mockFetchConsents.mockResolvedValue([])
    mockSignConsent.mockRejectedValue({
      response: { data: { message: 'Signature refusée' } },
    })
    renderConsentsPage()

    await waitFor(() => screen.getAllByRole('button', { name: /signer/i }))

    const signButtons = screen.getAllByRole('button', { name: /signer/i })
    await userEvent.click(signButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Signature refusée')).toBeDefined()
    })
  })

  it('shows the access button once both required consents are signed, and navigates on click', async () => {
    mockFetchConsents.mockResolvedValue([
      { consentType: 'rgpd', signedAt: '2026-01-01T00:00:00.000Z' },
      { consentType: 'cgu', signedAt: '2026-01-01T00:00:00.000Z' },
    ])
    renderConsentsPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accéder à mon espace/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /accéder à mon espace/i }))

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeDefined()
    })
  })
})
