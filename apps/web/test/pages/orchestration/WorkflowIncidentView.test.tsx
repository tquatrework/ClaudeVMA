/**
 * Tests pour WorkflowIncidentView (Phase 16)
 *
 * Couvre :
 * - Affichage du formulaire de recherche par correlationId
 * - Accès refusé pour un élève
 * - Affichage des événements après une recherche réussie
 * - Affichage du message "Aucun événement" si la liste est vide
 * - Gestion d'erreur de chargement
 * - L'état de chargement s'affiche pendant la recherche
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/orchestration')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchEventHistory } from '../../../src/api/orchestration'
import WorkflowIncidentView from '../../../src/pages/WorkflowIncidentView'
import type { IntegrationEventHistory } from '../../../src/api/orchestration'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchEventHistory = vi.mocked(fetchEventHistory)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TI_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

// ─── Fixtures événements ──────────────────────────────────────────────────────

const CORRELATION_ID = 'corr-test-uuid-123'

const EVENT_HISTORY_WITH_EVENTS: IntegrationEventHistory = {
  correlationId: CORRELATION_ID,
  count: 2,
  events: [
    {
      id: 'evt-1',
      correlationId: CORRELATION_ID,
      eventType: 'AccountCreated',
      sourceService: 'identity-access-service',
      payload: { accountId: 'acc-1', email: 'eleve@test.com' },
      occurredAt: '2026-06-18T10:00:01Z',
    },
    {
      id: 'evt-2',
      correlationId: CORRELATION_ID,
      eventType: 'ProfileUpdated',
      sourceService: 'profile-service',
      occurredAt: '2026-06-18T10:00:05Z',
    },
  ],
}

const EVENT_HISTORY_EMPTY: IntegrationEventHistory = {
  correlationId: CORRELATION_ID,
  count: 0,
  events: [],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkflowIncidentView />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkflowIncidentView', () => {
  it('affiche le formulaire de recherche par correlationId', () => {
    renderPage()
    expect(screen.getByText('Historique des événements')).toBeDefined()
    expect(screen.getByLabelText('correlationId')).toBeDefined()
    expect(screen.getByRole('button', { name: /rechercher/i })).toBeDefined()
  })

  it('un élève voit un message d\'accès refusé', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
  })

  it('affiche l\'état de chargement pendant la recherche', async () => {
    mockFetchEventHistory.mockReturnValue(new Promise(() => {}))
    renderPage()

    await userEvent.type(screen.getByLabelText('correlationId'), CORRELATION_ID)
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    expect(screen.getByText(/Chargement des événements/)).toBeDefined()
  })

  it('affiche les événements après une recherche réussie', async () => {
    mockFetchEventHistory.mockResolvedValue(EVENT_HISTORY_WITH_EVENTS)
    renderPage()

    await userEvent.type(screen.getByLabelText('correlationId'), CORRELATION_ID)
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText('AccountCreated')).toBeDefined()
      expect(screen.getByText('ProfileUpdated')).toBeDefined()
    })
    expect(screen.getByText(/identity-access-service/)).toBeDefined()
    expect(screen.getByText(/Événements \(2\)/)).toBeDefined()
  })

  it('affiche "Aucun événement" si la liste est vide', async () => {
    mockFetchEventHistory.mockResolvedValue(EVENT_HISTORY_EMPTY)
    renderPage()

    await userEvent.type(screen.getByLabelText('correlationId'), CORRELATION_ID)
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText(/Aucun événement trouvé pour ce correlationId/)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchEventHistory.mockRejectedValue(new Error('Not found'))
    renderPage()

    await userEvent.type(screen.getByLabelText('correlationId'), CORRELATION_ID)
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger l'historique des événements/)).toBeDefined()
    })
  })

  it('le bouton "Rechercher" est désactivé si le champ est vide', () => {
    renderPage()
    const searchButton = screen.getByRole('button', { name: /rechercher/i })
    expect((searchButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('appelle fetchEventHistory avec le bon correlationId', async () => {
    mockFetchEventHistory.mockResolvedValue(EVENT_HISTORY_WITH_EVENTS)
    renderPage()

    await userEvent.type(screen.getByLabelText('correlationId'), CORRELATION_ID)
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(mockFetchEventHistory).toHaveBeenCalledWith(CORRELATION_ID)
    })
  })
})
