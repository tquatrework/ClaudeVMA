/**
 * Tests for IncidentDetailPage
 *
 * Aucun test préexistant pour cette page — créé lors de la migration hors apiClient
 * (src/hooks/communication/useIncidentDetail, appuyé sur src/api/communication).
 *
 * Covers:
 * - Loading state while fetching the incident
 * - Renders incident details via fetchIncident
 * - Error states: 403 → "Accès refusé", 404 → "Incident introuvable", sinon générique
 * - Status change buttons only shown to authorized roles (TI, RP)
 * - Updates the status via updateIncidentStatus and shows the success message
 * - Shows an error message when the status update fails
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IncidentDetailPage from '../../src/pages/IncidentDetailPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/communication')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchIncident, updateIncidentStatus } from '../../src/api/communication'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchIncident = vi.mocked(fetchIncident)
const mockUpdateIncidentStatus = vi.mocked(updateIncidentStatus)

const INCIDENT_ID = 'inc-detail-001'

const SAMPLE_INCIDENT = {
  id: INCIDENT_ID,
  title: 'Connexion impossible',
  description: 'Depuis ce matin',
  status: 'open' as const,
  createdAt: '2026-07-01T08:00:00Z',
  reporterId: 'user-42',
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/incidents/${INCIDENT_ID}`]}>
      <Routes>
        <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setupAuth(role: string, canUpdate: boolean) {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: `${role}@test.com`, role: role as never, validationStatus: 'active' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => canUpdate),
    isInternalRole: vi.fn(() => false),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuth('technicien_informatique', true)
})

describe('IncidentDetailPage', () => {
  it('shows loading indicator while fetching the incident', () => {
    mockFetchIncident.mockReturnValue(new Promise(() => {}))

    renderDetail()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders incident details', async () => {
    mockFetchIncident.mockResolvedValue(SAMPLE_INCIDENT)

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Connexion impossible')).toBeDefined()
      expect(screen.getByText('Depuis ce matin')).toBeDefined()
      expect(screen.getByText('user-42')).toBeDefined()
    })
  })

  it('shows "Accès refusé" when loading fails with 403', async () => {
    mockFetchIncident.mockRejectedValue({ response: { status: 403 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows "Incident introuvable" when loading fails with 404', async () => {
    mockFetchIncident.mockRejectedValue({ response: { status: 404 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Incident introuvable')).toBeDefined()
    })
  })

  it('shows a generic error for other failures', async () => {
    mockFetchIncident.mockRejectedValue({ response: { status: 500 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement')).toBeDefined()
    })
  })

  it('shows status change buttons for an authorized role', async () => {
    mockFetchIncident.mockResolvedValue(SAMPLE_INCIDENT)
    setupAuth('technicien_informatique', true)

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Changer le statut')).toBeDefined()
    })
  })

  it('hides status change buttons for a non-authorized role', async () => {
    mockFetchIncident.mockResolvedValue(SAMPLE_INCIDENT)
    setupAuth('eleve', false)

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Connexion impossible')).toBeDefined()
    })
    expect(screen.queryByText('Changer le statut')).toBeNull()
  })

  it('updates the status via updateIncidentStatus and shows a success message', async () => {
    mockFetchIncident.mockResolvedValue(SAMPLE_INCIDENT)
    mockUpdateIncidentStatus.mockResolvedValue({ ...SAMPLE_INCIDENT, status: 'in_progress' })

    renderDetail()

    await waitFor(() => screen.getByText('Changer le statut'))

    await userEvent.click(screen.getByRole('button', { name: /passer en « en cours »/i }))

    await waitFor(() => {
      expect(mockUpdateIncidentStatus).toHaveBeenCalledWith(INCIDENT_ID, { status: 'in_progress' })
      expect(screen.getByText('Statut mis à jour')).toBeDefined()
    })
  })

  it('shows an error message when the status update fails', async () => {
    mockFetchIncident.mockResolvedValue(SAMPLE_INCIDENT)
    mockUpdateIncidentStatus.mockRejectedValue({
      response: { data: { message: 'Transition non autorisée' } },
    })

    renderDetail()

    await waitFor(() => screen.getByText('Changer le statut'))

    await userEvent.click(screen.getByRole('button', { name: /passer en « en cours »/i }))

    await waitFor(() => {
      expect(screen.getByText('Transition non autorisée')).toBeDefined()
    })
  })
})
