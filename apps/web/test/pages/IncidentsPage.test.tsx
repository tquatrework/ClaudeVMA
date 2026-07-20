/**
 * Tests for IncidentsPage
 *
 * Aucun test préexistant pour cette page — créé lors de la migration hors apiClient
 * (src/hooks/communication/useIncidents, appuyé sur src/api/communication).
 *
 * Covers:
 * - Loading state while fetching incidents
 * - Renders incident list via fetchIncidents
 * - Empty state when no incidents
 * - Error state when loading fails (403 → "Accès refusé", sinon message générique)
 * - "Déclarer un incident" button visible only for roles allowed to create
 * - Creates an incident via createIncident and clears the form
 * - Error state when creation fails
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IncidentsPage from '../../src/pages/IncidentsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/communication')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchIncidents, createIncident } from '../../src/api/communication'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchIncidents = vi.mocked(fetchIncidents)
const mockCreateIncident = vi.mocked(createIncident)

const SAMPLE_INCIDENTS = [
  {
    id: 'inc-1',
    title: 'Connexion impossible',
    description: 'Depuis ce matin',
    status: 'open' as const,
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'inc-2',
    title: 'Vidéo qui coupe',
    status: 'resolved' as const,
    createdAt: '2026-06-30T10:00:00Z',
  },
]

function renderIncidents() {
  return render(
    <MemoryRouter>
      <IncidentsPage />
    </MemoryRouter>,
  )
}

function setupAuth(role: string, canCreate: boolean) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: `${role}@test.com`, role: role as never, validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => canCreate),
    isInternalRole: vi.fn(() => false),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth('technicien_informatique', true)
})

describe('IncidentsPage', () => {
  it('shows loading indicator while fetching incidents', () => {
    mockFetchIncidents.mockReturnValue(new Promise(() => {}))

    renderIncidents()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders the incident list', async () => {
    mockFetchIncidents.mockResolvedValue(SAMPLE_INCIDENTS)

    renderIncidents()

    await waitFor(() => {
      expect(screen.getByText('Connexion impossible')).toBeDefined()
      expect(screen.getByText('Vidéo qui coupe')).toBeDefined()
    })
  })

  it('shows empty state when no incidents exist', async () => {
    mockFetchIncidents.mockResolvedValue([])

    renderIncidents()

    await waitFor(() => {
      expect(screen.getByText('Aucun incident déclaré')).toBeDefined()
    })
  })

  it('shows "Accès refusé" when loading fails with 403', async () => {
    mockFetchIncidents.mockRejectedValue({ response: { status: 403 } })

    renderIncidents()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows generic error message when loading fails with another status', async () => {
    mockFetchIncidents.mockRejectedValue({ response: { status: 500 } })

    renderIncidents()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les incidents')).toBeDefined()
    })
  })

  it('shows the "Déclarer un incident" button when the role is allowed to create', async () => {
    mockFetchIncidents.mockResolvedValue([])
    setupAuth('technicien_informatique', true)

    renderIncidents()

    expect(screen.getByRole('button', { name: /déclarer un incident/i })).toBeDefined()
  })

  it('hides the "Déclarer un incident" button when the role is not allowed to create', async () => {
    mockFetchIncidents.mockResolvedValue([])
    setupAuth('administrateur_financier', false)

    renderIncidents()

    await waitFor(() => {
      expect(screen.getByText('Aucun incident déclaré')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /déclarer un incident/i })).toBeNull()
  })

  it('creates an incident via createIncident and clears the form', async () => {
    const createdIncident = {
      id: 'inc-new',
      title: 'Nouveau problème',
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    }
    mockFetchIncidents.mockResolvedValue([])
    mockCreateIncident.mockResolvedValue(createdIncident)

    renderIncidents()

    await waitFor(() => screen.getByText('Aucun incident déclaré'))

    await userEvent.click(screen.getByRole('button', { name: /déclarer un incident/i }))
    await userEvent.type(
      screen.getByPlaceholderText(/connexion impossible/i),
      'Nouveau problème',
    )
    await userEvent.click(screen.getByRole('button', { name: /^déclarer$/i }))

    await waitFor(() => {
      expect(mockCreateIncident).toHaveBeenCalledWith({
        title: 'Nouveau problème',
        description: undefined,
      })
      expect(screen.getByText('Nouveau problème')).toBeDefined()
    })
  })

  it('shows an error message when incident creation fails', async () => {
    mockFetchIncidents.mockResolvedValue([])
    mockCreateIncident.mockRejectedValue({
      response: { data: { message: 'Titre invalide' } },
    })

    renderIncidents()

    await waitFor(() => screen.getByText('Aucun incident déclaré'))

    await userEvent.click(screen.getByRole('button', { name: /déclarer un incident/i }))
    await userEvent.type(screen.getByPlaceholderText(/connexion impossible/i), 'Test erreur')
    await userEvent.click(screen.getByRole('button', { name: /^déclarer$/i }))

    await waitFor(() => {
      expect(screen.getByText('Titre invalide')).toBeDefined()
    })
  })
})
