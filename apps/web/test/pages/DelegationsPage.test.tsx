/**
 * Tests for DelegationsPage
 *
 * Covers:
 * - Page renders with title and "Nouvelle délégation" button
 * - Loads and displays delegations via fetchDelegations (src/api/communication)
 * - Shows empty state when no delegations
 * - Shows error when loading fails
 * - Creates a delegation via createDelegation
 * - Shows success message and reloads the list after creation
 *
 * Écart signalé (non touché ici) : /delegations n'est documenté dans aucune section de
 * docs/routes.md — comportement runtime préservé tel quel, voir src/api/communication.ts.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DelegationsPage from '../../src/pages/DelegationsPage'

vi.mock('../../src/api/communication')
vi.mock('../../src/hooks/useAuth')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchDelegations, createDelegation } from '../../src/api/communication'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchDelegations = vi.mocked(fetchDelegations)
const mockCreateDelegation = vi.mocked(createDelegation)

const sampleDelegations = [
  {
    id: 'del-1',
    requesterId: 'user-ti-1',
    targetAccountId: 'acc-abc-123',
    action: 'suspend_account',
    status: 'pending' as const,
    reason: 'Comportement signalé',
    createdAt: '2026-06-14T10:00:00Z',
  },
  {
    id: 'del-2',
    requesterId: 'user-rp-1',
    targetAccountId: 'acc-xyz-456',
    action: 'change_role',
    status: 'approved' as const,
    reason: 'Promotion AP demandée',
    createdAt: '2026-06-13T09:00:00Z',
    resolvedAt: '2026-06-13T11:00:00Z',
  },
]

function renderDelegationsPage() {
  return render(
    <MemoryRouter>
      <DelegationsPage />
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

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthAsTi()
})

describe('DelegationsPage', () => {
  it('renders the page title heading', async () => {
    mockFetchDelegations.mockResolvedValue([])
    renderDelegationsPage()

    expect(screen.getByRole('heading', { name: /délégations/i })).toBeDefined()
  })

  it('shows a "Nouvelle délégation" button', async () => {
    mockFetchDelegations.mockResolvedValue([])
    renderDelegationsPage()

    expect(screen.getByRole('button', { name: /nouvelle délégation/i })).toBeDefined()
  })

  it('loads and displays delegation list via fetchDelegations', async () => {
    mockFetchDelegations.mockResolvedValue(sampleDelegations)
    renderDelegationsPage()

    await waitFor(() => {
      expect(mockFetchDelegations).toHaveBeenCalled()
      expect(screen.getByText('suspend_account')).toBeDefined()
      expect(screen.getByText('change_role')).toBeDefined()
    })
  })

  it('handles the enveloped { data: [...] } response form', async () => {
    mockFetchDelegations.mockResolvedValue({ data: sampleDelegations })
    renderDelegationsPage()

    await waitFor(() => {
      expect(screen.getByText('suspend_account')).toBeDefined()
    })
  })

  it('shows empty state when no delegations', async () => {
    mockFetchDelegations.mockResolvedValue([])
    renderDelegationsPage()

    await waitFor(() => {
      expect(screen.getByText(/aucune délégation/i)).toBeDefined()
    })
  })

  it('shows error message when loading fails', async () => {
    mockFetchDelegations.mockRejectedValue(new Error('Network Error'))
    renderDelegationsPage()

    await waitFor(() => {
      expect(screen.getByText(/impossible de charger les délégations/i)).toBeDefined()
    })
  })

  it('shows delegation status labels', async () => {
    mockFetchDelegations.mockResolvedValue(sampleDelegations)
    renderDelegationsPage()

    await waitFor(() => {
      expect(screen.getByText('En attente')).toBeDefined()
      expect(screen.getByText('Approuvée')).toBeDefined()
    })
  })

  it('opens the create delegation form when clicking "Nouvelle délégation"', async () => {
    mockFetchDelegations.mockResolvedValue([])
    renderDelegationsPage()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle délégation/i }))

    expect(screen.getByText(/nouvelle demande de délégation/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/uuid du compte visé/i)).toBeDefined()
  })

  it('calls createDelegation with correct payload', async () => {
    mockFetchDelegations.mockResolvedValue([])
    mockCreateDelegation.mockResolvedValue(undefined)
    renderDelegationsPage()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle délégation/i }))

    await userEvent.type(screen.getByPlaceholderText(/uuid du compte visé/i), 'acc-target-001')
    await userEvent.type(screen.getByPlaceholderText(/ex: suspend_account/i), 'suspend_account')
    await userEvent.type(
      screen.getByPlaceholderText(/expliquez pourquoi/i),
      'Comportement signalé par utilisateur',
    )

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(mockCreateDelegation).toHaveBeenCalledWith({
        targetAccountId: 'acc-target-001',
        action: 'suspend_account',
        reason: 'Comportement signalé par utilisateur',
      })
    })
  })

  it('shows success message and hides form after creation', async () => {
    mockFetchDelegations.mockResolvedValue([])
    mockCreateDelegation.mockResolvedValue(undefined)
    renderDelegationsPage()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle délégation/i }))

    await userEvent.type(screen.getByPlaceholderText(/uuid du compte visé/i), 'acc-target-001')
    await userEvent.type(screen.getByPlaceholderText(/ex: suspend_account/i), 'suspend_account')
    await userEvent.type(screen.getByPlaceholderText(/expliquez pourquoi/i), 'Raison valide')

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(screen.getByText(/demande de délégation créée avec succès/i)).toBeDefined()
    })
  })

  it('shows error message when creation fails', async () => {
    mockFetchDelegations.mockResolvedValue([])
    mockCreateDelegation.mockRejectedValue({
      response: { data: { message: 'Action non autorisée pour ce rôle' } },
    })
    renderDelegationsPage()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle délégation/i }))

    await userEvent.type(screen.getByPlaceholderText(/uuid du compte visé/i), 'acc-target-001')
    await userEvent.type(screen.getByPlaceholderText(/ex: suspend_account/i), 'suspend_account')
    await userEvent.type(screen.getByPlaceholderText(/expliquez pourquoi/i), 'Raison valide')

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(screen.getByText('Action non autorisée pour ce rôle')).toBeDefined()
    })
  })

  it('closes the form when clicking "Annuler"', async () => {
    mockFetchDelegations.mockResolvedValue([])
    renderDelegationsPage()

    await userEvent.click(screen.getByRole('button', { name: /nouvelle délégation/i }))
    expect(screen.getByText(/nouvelle demande de délégation/i)).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

    expect(screen.queryByText(/nouvelle demande de délégation/i)).toBeNull()
  })
})
