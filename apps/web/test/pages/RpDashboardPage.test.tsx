/**
 * Tests pour RpDashboardPage (dashboard-notification-service / teacher-request-service)
 *
 * Couvre :
 * - Compteur de demandes ouvertes (GET /teacher-requests?scope=open)
 * - Dégradation vers 0 en cas d'échec (un indicateur secondaire n'alarme pas)
 * - Notifications affichées via ActivityFeed
 *
 * Le compteur interrogeait `/requests`, second nom de la même ressource que
 * `/teacher-requests` — un seul nom par donnée, l'écart est résorbé. Et il filtrait
 * `status === 'pending'` côté front alors que `scope=open` est la portée du flow :
 * une demande `redirected` reste à instruire par le RP.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RpDashboardPage from '../../src/pages/RpDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/teacherRequests')
vi.mock('../../src/api/dashboardNotifications')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchTeacherRequests } from '../../src/api/teacherRequests'
import { fetchNotifications } from '../../src/api/dashboardNotifications'
import { fetchPendingTeachers } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTeacherRequests = vi.mocked(fetchTeacherRequests)
const mockFetchNotifications = vi.mocked(fetchNotifications)
const mockFetchPendingTeachers = vi.mocked(fetchPendingTeachers)

function buildPendingTeachersPage(total: number) {
  return { data: [], page: 1, limit: 1, total, totalPages: total }
}

const RP_USER = {
  id: 'rp-1',
  loginIdentifier: 'rp1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: RP_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => true),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <RpDashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
  mockFetchTeacherRequests.mockResolvedValue([])
  mockFetchPendingTeachers.mockResolvedValue(buildPendingTeachersPage(0))
})

describe('RpDashboardPage — demandes professeur en attente', () => {
  it('demande la portée « ouverte » au serveur, sans refiltrer côté front', async () => {
    mockFetchTeacherRequests.mockResolvedValue([])

    renderDashboard()

    await waitFor(() => {
      expect(mockFetchTeacherRequests).toHaveBeenCalledWith('open')
    })
  })

  it('compte toutes les demandes ouvertes, y compris celles déjà proposées', async () => {
    // Une demande `redirected` reste à instruire : le RP doit encore trancher.
    // L'ancien filtre `status === 'pending'` la faisait disparaître du compteur.
    mockFetchTeacherRequests.mockResolvedValue([
      { id: 'req-1', status: 'pending', createdAt: new Date().toISOString() },
      { id: 'req-2', status: 'redirected', createdAt: new Date().toISOString() },
    ] as never)

    renderDashboard()

    await waitFor(() => {
      const matches = screen.getAllByText('2')
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('retombe sur 0 (pas de message d\'erreur) en cas d\'échec de chargement', async () => {
    mockFetchTeacherRequests.mockRejectedValue({ response: { status: 500 } })

    renderDashboard()

    await waitFor(() => {
      const matches = screen.getAllByText('0')
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})

describe('RpDashboardPage — notifications', () => {
  it('affiche les notifications récentes', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Compte à valider', read: false, createdAt: new Date().toISOString() },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Compte à valider')).toBeDefined()
    })
  })
})

describe('RpDashboardPage — nouveaux formateurs à examiner', () => {
  it('compte le total de la file, pas la longueur de la page reçue', async () => {
    // La file est paginée : compter `data.length` annoncerait « 1 » sur 17.
    mockFetchPendingTeachers.mockResolvedValue(buildPendingTeachersPage(17))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('17').length).toBeGreaterThan(0)
    })
    expect(mockFetchPendingTeachers).toHaveBeenCalledWith(1, 1)
  })

  it('mène à la file de validation', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPendingTeachersPage(3))

    renderDashboard()

    const link = await screen.findByRole('link', { name: /nouveaux formateurs à examiner/i })
    expect(link.getAttribute('href')).toBe('/rp/teacher-validations')
  })

  it("retombe sur 0 sans alarmer quand la file n'est pas lisible", async () => {
    mockFetchPendingTeachers.mockRejectedValue({ response: { status: 403 } })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    })
  })
})
