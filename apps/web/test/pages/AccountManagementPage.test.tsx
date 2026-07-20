/**
 * Tests for AccountManagementPage
 *
 * Covers:
 * - Form rendering for status change
 * - Regenerate access section only visible for TI
 * - Status change calls changeAccountStatus(accountId, {status, reason})
 * - Regenerate access calls regenerateAccountAccess(accountId, {reason})
 * - Success and error messages
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AccountManagementPage from '../../src/pages/AccountManagementPage'

vi.mock('../../src/api/accounts')
vi.mock('../../src/hooks/useAuth')

import { changeAccountStatus, regenerateAccountAccess } from '../../src/api/accounts'
import { useAuth } from '../../src/hooks/useAuth'

const mockChangeAccountStatus = vi.mocked(changeAccountStatus)
const mockRegenerateAccountAccess = vi.mocked(regenerateAccountAccess)
const mockUseAuth = vi.mocked(useAuth)

function renderAccountManagementPage() {
  return render(
    <MemoryRouter>
      <AccountManagementPage />
    </MemoryRouter>,
  )
}

function setupAuthAsTi() {
  mockUseAuth.mockReturnValue({
    user: { id: 'ti-1', email: 'ti@test.com', role: 'technicien_informatique', validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes('technicien_informatique')),
    isInternalRole: vi.fn().mockReturnValue(true),
  })
}

function setupAuthAsRp() {
  mockUseAuth.mockReturnValue({
    user: { id: 'rp-1', email: 'rp@test.com', role: 'responsable_pedagogique', validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes('responsable_pedagogique')),
    isInternalRole: vi.fn().mockReturnValue(true),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AccountManagementPage', () => {
  it('renders the status change section heading', () => {
    setupAuthAsRp()
    renderAccountManagementPage()

    expect(screen.getByText(/changer le statut d'un compte/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /appliquer le changement/i })).toBeDefined()
  })

  it('renders the status change form with a select for the new status', () => {
    setupAuthAsRp()
    renderAccountManagementPage()

    const selectElement = screen.getByRole('combobox')
    const optionValues = Array.from((selectElement as HTMLSelectElement).options).map(o => o.value)
    expect(optionValues).toContain('active')
    expect(optionValues).toContain('suspended')
    expect(optionValues).toContain('pending')
  })

  it('shows the regenerate access section for TI', () => {
    setupAuthAsTi()
    renderAccountManagementPage()

    expect(screen.getByText(/réactiver un accès/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /régénérer l'accès/i })).toBeDefined()
  })

  it('hides the regenerate access section for RP', () => {
    setupAuthAsRp()
    renderAccountManagementPage()

    expect(screen.queryByText(/réactiver un accès/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /régénérer l'accès/i })).toBeNull()
  })

  it('calls changeAccountStatus with the account id, status and reason', async () => {
    setupAuthAsRp()
    mockChangeAccountStatus.mockResolvedValue(undefined)
    renderAccountManagementPage()

    // RP only has the status form — use label-based queries
    await userEvent.type(screen.getByLabelText(/identifiant du compte/i), 'acc-uuid-123')

    const statusSelect = screen.getByRole('combobox')
    await userEvent.selectOptions(statusSelect, 'suspended')

    await userEvent.type(screen.getByLabelText(/motif \*/i), 'Comportement inapproprié')

    await userEvent.click(screen.getByRole('button', { name: /appliquer le changement/i }))

    await waitFor(() => {
      expect(mockChangeAccountStatus).toHaveBeenCalledWith('acc-uuid-123', {
        status: 'suspended',
        reason: 'Comportement inapproprié',
      })
    })
  })

  it('shows success message after status change', async () => {
    setupAuthAsRp()
    mockChangeAccountStatus.mockResolvedValue(undefined)
    renderAccountManagementPage()

    await userEvent.type(screen.getByLabelText(/identifiant du compte/i), 'acc-uuid-456')
    await userEvent.type(screen.getByLabelText(/motif \*/i), 'Test reason')

    await userEvent.click(screen.getByRole('button', { name: /appliquer le changement/i }))

    await waitFor(() => {
      expect(screen.getByText(/mis à jour/i)).toBeDefined()
    })
  })

  it('calls regenerateAccountAccess with the account id and reason for TI', async () => {
    setupAuthAsTi()
    mockRegenerateAccountAccess.mockResolvedValue(undefined)
    renderAccountManagementPage()

    // TI sees two "Identifiant du compte" inputs — use the second one via getAllByLabelText
    const accountIdInputs = screen.getAllByLabelText(/identifiant du compte/i)
    expect(accountIdInputs.length).toBe(2)
    await userEvent.type(accountIdInputs[1], 'acc-uuid-789')

    await userEvent.type(screen.getByLabelText(/motif de la réactivation/i), 'Utilisateur bloqué sans raison')

    await userEvent.click(screen.getByRole('button', { name: /régénérer l'accès/i }))

    await waitFor(() => {
      expect(mockRegenerateAccountAccess).toHaveBeenCalledWith('acc-uuid-789', {
        reason: 'Utilisateur bloqué sans raison',
      })
    })
  })

  it('shows regenerate success message for TI', async () => {
    setupAuthAsTi()
    mockRegenerateAccountAccess.mockResolvedValue(undefined)
    renderAccountManagementPage()

    const accountIdInputs = screen.getAllByLabelText(/identifiant du compte/i)
    await userEvent.type(accountIdInputs[1], 'acc-uuid-789')
    await userEvent.type(screen.getByLabelText(/motif de la réactivation/i), 'Raison valide')

    await userEvent.click(screen.getByRole('button', { name: /régénérer l'accès/i }))

    await waitFor(() => {
      expect(screen.getByText(/accès régénéré/i)).toBeDefined()
    })
  })

  it('displays API error when status change fails', async () => {
    setupAuthAsRp()
    mockChangeAccountStatus.mockRejectedValue({
      response: { data: { message: 'Compte introuvable' } },
    })
    renderAccountManagementPage()

    await userEvent.type(screen.getByLabelText(/identifiant du compte/i), 'unknown-uuid')
    await userEvent.type(screen.getByLabelText(/motif \*/i), 'Test error')

    await userEvent.click(screen.getByRole('button', { name: /appliquer le changement/i }))

    await waitFor(() => {
      expect(screen.getByText('Compte introuvable')).toBeDefined()
    })
  })

  it('displays API error when regenerate access fails', async () => {
    setupAuthAsTi()
    mockRegenerateAccountAccess.mockRejectedValue({
      response: { data: { message: 'Compte introuvable' } },
    })
    renderAccountManagementPage()

    const accountIdInputs = screen.getAllByLabelText(/identifiant du compte/i)
    await userEvent.type(accountIdInputs[1], 'unknown-uuid')
    await userEvent.type(screen.getByLabelText(/motif de la réactivation/i), 'Test error')

    await userEvent.click(screen.getByRole('button', { name: /régénérer l'accès/i }))

    await waitFor(() => {
      expect(screen.getByText('Compte introuvable')).toBeDefined()
    })
  })
})
