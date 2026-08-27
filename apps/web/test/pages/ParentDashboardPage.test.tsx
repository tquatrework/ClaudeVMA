/**
 * Tests pour ParentDashboardPage (profile-service / calendar-service)
 *
 * Couvre :
 * - Affichage de tous les élèves rattachés (pattern multi-élèves sans sélecteur)
 * - État vide (aucun élève rattaché)
 * - Un échec du calendrier d'UN élève affiche un message d'erreur sur SA carte sans
 *   empêcher l'affichage des autres élèves (comportement non bloquant)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentDashboardPage from '../../src/pages/ParentDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/calendar')
vi.mock('../../src/components/pedagogical-log/MemoReadOnlyModal', () => ({
  MemoReadOnlyModal: (props: { studentId: string; title?: string; onClose: () => void }) => (
    <div data-testid="memo-modal-stub">
      <p>{props.title}</p>
      <p>studentId: {props.studentId}</p>
      <button onClick={props.onClose}>Fermer (mock)</button>
    </div>
  ),
}))

import { useAuth } from '../../src/hooks/useAuth'
import { fetchLinkedStudents, fetchStudentProfile } from '../../src/api/relations'
import { fetchUserEvents } from '../../src/api/calendar'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchLinkedStudents = vi.mocked(fetchLinkedStudents)
const mockFetchStudentProfile = vi.mocked(fetchStudentProfile)
const mockFetchUserEvents = vi.mocked(fetchUserEvents)

const PARENT_USER = {
  id: 'parent-1',
  loginIdentifier: 'parent1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: PARENT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ParentDashboardPage />
    </MemoryRouter>,
  )
}

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ParentDashboardPage — état vide', () => {
  it('affiche un état vide quand aucun élève n\'est rattaché', async () => {
    mockFetchLinkedStudents.mockResolvedValue([])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucun élève rattaché à votre compte.')).toBeDefined()
    })
  })
})

describe('ParentDashboardPage — plusieurs élèves', () => {
  it('affiche tous les élèves rattachés sans sélecteur', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: 'parent-1', studentId: 'student-1', createdAt: FUTURE_ISO_1 },
      { financeOwnerId: 'parent-1', studentId: 'student-2', createdAt: FUTURE_ISO_1 },
    ])
    mockFetchStudentProfile.mockImplementation(async (studentId: string) => ({
      userId: studentId,
      loginIdentifier: `${studentId}-login`,
      // Clé courte `administrative` = forme réelle de GET /profiles/:userId.
      administrative: { firstName: studentId === 'student-1' ? 'Alice' : 'Bob', lastName: 'Test' },
    }))
    mockFetchUserEvents.mockResolvedValue([])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Alice Test')).toBeDefined()
      expect(screen.getByText('Bob Test')).toBeDefined()
    })
  })

  it('affiche un message d\'erreur sur la carte de l\'élève dont le calendrier échoue, sans bloquer les autres', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: 'parent-1', studentId: 'student-1', createdAt: FUTURE_ISO_1 },
      { financeOwnerId: 'parent-1', studentId: 'student-2', createdAt: FUTURE_ISO_1 },
    ])
    mockFetchStudentProfile.mockImplementation(async (studentId: string) => ({
      userId: studentId,
      loginIdentifier: `${studentId}-login`,
      // Clé courte `administrative` = forme réelle de GET /profiles/:userId.
      administrative: { firstName: studentId === 'student-1' ? 'Alice' : 'Bob', lastName: 'Test' },
    }))
    mockFetchUserEvents.mockImplementation(async (studentId: string) => {
      if (studentId === 'student-1') {
        throw { response: { status: 500 } }
      }
      return [{ id: 'evt-1', title: 'Cours de Bob', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 }]
    })

    renderDashboard()

    // La carte de l'élève dont le calendrier échoue affiche un message d'erreur…
    await waitFor(() => {
      expect(screen.getByText('Alice Test')).toBeDefined()
      expect(screen.getByText('Le serveur rencontre un problème. Veuillez réessayer plus tard.')).toBeDefined()
    })

    // …tandis que l'autre élève affiche normalement son prochain cours.
    expect(screen.getByText('Bob Test')).toBeDefined()
    expect(screen.getByText('Cours de Bob')).toBeDefined()
  })

  it('propose « Mémos » sur chaque carte élève et ouvre la modale sur le bon élève', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: 'parent-1', studentId: 'student-1', createdAt: FUTURE_ISO_1 },
      { financeOwnerId: 'parent-1', studentId: 'student-2', createdAt: FUTURE_ISO_1 },
    ])
    mockFetchStudentProfile.mockImplementation(async (studentId: string) => ({
      userId: studentId,
      loginIdentifier: `${studentId}-login`,
      administrative: { firstName: studentId === 'student-1' ? 'Alice' : 'Bob', lastName: 'Test' },
    }))
    mockFetchUserEvents.mockResolvedValue([])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Alice Test')).toBeDefined()
      expect(screen.getByText('Bob Test')).toBeDefined()
    })

    expect(screen.queryByTestId('memo-modal-stub')).toBeNull()

    const memoButtons = screen.getAllByRole('button', { name: 'Mémos' })
    expect(memoButtons).toHaveLength(2)

    // Carte d'Alice = première carte (ordre des studentCards).
    await userEvent.click(memoButtons[0])

    expect(screen.getByTestId('memo-modal-stub')).toBeDefined()
    expect(screen.getByText('Mémo de Alice Test')).toBeDefined()
    expect(screen.getByText('studentId: student-1')).toBeDefined()

    // Toujours affiché derrière la modale, sans navigation.
    expect(screen.getByText('Bob Test')).toBeDefined()
  })

  it('ferme la modale du mémo depuis le dashboard parent', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: 'parent-1', studentId: 'student-1', createdAt: FUTURE_ISO_1 },
    ])
    mockFetchStudentProfile.mockResolvedValue({
      userId: 'student-1',
      loginIdentifier: 'student-1-login',
      administrative: { firstName: 'Alice', lastName: 'Test' },
    })
    mockFetchUserEvents.mockResolvedValue([])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mémos' })).toBeDefined()
    })
    await userEvent.click(screen.getByRole('button', { name: 'Mémos' }))
    expect(screen.getByTestId('memo-modal-stub')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Fermer (mock)' }))

    expect(screen.queryByTestId('memo-modal-stub')).toBeNull()
  })

  it('affiche "Élève inconnu" quand le profil échoue, sans bloquer le calendrier', async () => {
    mockFetchLinkedStudents.mockResolvedValue([
      { financeOwnerId: 'parent-1', studentId: 'student-1', createdAt: FUTURE_ISO_1 },
    ])
    mockFetchStudentProfile.mockRejectedValue({ response: { status: 404 } })
    mockFetchUserEvents.mockResolvedValue([
      { id: 'evt-1', title: 'Cours malgré profil manquant', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Élève inconnu')).toBeDefined()
      expect(screen.getByText('Cours malgré profil manquant')).toBeDefined()
    })
  })
})
