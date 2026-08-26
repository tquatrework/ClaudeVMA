/**
 * Tests pour ActivityDetailPage (calendar-service / video-session-service)
 *
 * Couvre :
 * - Chargement puis affichage du détail d'une activité
 * - États d'erreur (403 → "Accès refusé", 404 → "Activité introuvable", autre → générique)
 * - Édition (titre/statut) avec succès et échec
 * - Suppression (confirmation, navigation vers /calendar)
 * - Création de salle de visio
 * - Le parent financeur ne voit jamais la zone visio
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActivityDetailPage from '../../src/pages/ActivityDetailPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')
vi.mock('../../src/api/pedagogicalLog')
vi.mock('../../src/api/video')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchActivity, updateActivity, deleteActivity } from '../../src/api/calendar'
import { fetchSessionLogs } from '../../src/api/pedagogicalLog'
import { createRoom } from '../../src/api/video'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchActivity = vi.mocked(fetchActivity)
const mockUpdateActivity = vi.mocked(updateActivity)
const mockDeleteActivity = vi.mocked(deleteActivity)
const mockFetchSessionLogs = vi.mocked(fetchSessionLogs)
const mockCreateRoom = vi.mocked(createRoom)

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TEACHER_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderDetail(activityId = 'act-1') {
  return render(
    <MemoryRouter initialEntries={[`/activities/${activityId}`]}>
      <Routes>
        <Route path="/activities/:activityId" element={<ActivityDetailPage />} />
        <Route path="/calendar" element={<div>Calendrier</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const SAMPLE_ACTIVITY = {
  id: 'act-1',
  title: 'Cours de mathématiques',
  startAt: new Date(Date.now() + 3600000).toISOString(),
  endAt: new Date(Date.now() + 7200000).toISOString(),
  type: 'course',
  status: 'scheduled',
  studentId: 'student-1',
  teacherId: 'teacher-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchSessionLogs.mockResolvedValue([])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ActivityDetailPage — chargement', () => {
  it('affiche le chargement puis le détail de l\'activité', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)

    renderDetail()

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })
  })

  it('affiche "Accès refusé" sur une erreur 403', async () => {
    mockFetchActivity.mockRejectedValue({ response: { status: 403 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('affiche "Activité introuvable" sur une erreur 404', async () => {
    mockFetchActivity.mockRejectedValue({ response: { status: 404 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Activité introuvable')).toBeDefined()
    })
  })

  it('affiche une erreur générique sur un autre statut', async () => {
    mockFetchActivity.mockRejectedValue({ response: { status: 500 } })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement')).toBeDefined()
    })
  })

  it('rend un lien [label](url) de sessionSummary comme un vrai lien cliquable', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockFetchSessionLogs.mockResolvedValue([
      {
        id: 'log-1',
        studentId: 'student-1',
        authorId: 'teacher-1',
        authorRole: 'formateur',
        content: null,
        date: '2026-08-20',
        sessionSummary: 'Voir la fiche [ici](https://exemple.fr/fiche.pdf) pour réviser.',
        homework: null,
        visibility: 'eleve_parent_formateur',
        isSpecialPage: false,
        hiddenFromStudent: false,
        createdAt: new Date().toISOString(),
      },
    ])

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    const link = await screen.findByRole('link', { name: 'ici' })
    expect(link.getAttribute('href')).toBe('https://exemple.fr/fiche.pdf')
    expect(screen.queryByText((text) => text.includes('[ici]'))).toBeNull()
  })

  it('charge les logs de séance de façon non bloquante en cas d\'échec', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockFetchSessionLogs.mockRejectedValue(new Error('log service down'))

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })
    // Pas de crash, pas de message d'erreur bloquant l'affichage de l'activité
    expect(screen.queryByText('Erreur lors du chargement')).toBeNull()
  })
})

describe('ActivityDetailPage — édition', () => {
  it('modifie le titre avec succès', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockUpdateActivity.mockResolvedValue({ ...SAMPLE_ACTIVITY, title: 'Nouveau titre' })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))

    const titleInput = screen.getByDisplayValue('Cours de mathématiques')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Nouveau titre')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockUpdateActivity).toHaveBeenCalledWith(
        'act-1',
        expect.objectContaining({ title: 'Nouveau titre' }),
      )
      expect(screen.getByText('Activité mise à jour')).toBeDefined()
    })
  })

  it('affiche le message d\'erreur backend en cas d\'échec de la modification', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockUpdateActivity.mockRejectedValue({
      response: { data: { message: 'Modification refusée' } },
    })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /modifier/i }))
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(screen.getByText('Modification refusée')).toBeDefined()
    })
  })
})

describe('ActivityDetailPage — suppression', () => {
  it('supprime l\'activité et navigue vers /calendar', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock({ ...TEACHER_USER, role: 'responsable_pedagogique' as const }))
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockDeleteActivity.mockResolvedValue(undefined)

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer l'activité/i }))

    await waitFor(() => {
      expect(mockDeleteActivity).toHaveBeenCalledWith('act-1')
      expect(mockNavigate).toHaveBeenCalledWith('/calendar')
    })
  })
})

describe('ActivityDetailPage — salle de visio', () => {
  it('crée une salle de visio après confirmation', async () => {
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)
    mockCreateRoom.mockResolvedValue({ id: 'room-1', status: 'active' })

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /créer une salle de visio/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirmer/i }))

    await waitFor(() => {
      expect(mockCreateRoom).toHaveBeenCalledWith({ activityId: 'act-1' })
      expect(screen.getByText('Salle de visio créée')).toBeDefined()
      expect(screen.getByText('Rejoindre la visio')).toBeDefined()
    })
  })

  it('ne montre jamais la zone visio à un parent financeur', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
    mockFetchActivity.mockResolvedValue(SAMPLE_ACTIVITY)

    renderDetail()

    await waitFor(() => {
      expect(screen.getByText('Cours de mathématiques')).toBeDefined()
    })

    expect(screen.queryByText('Créer une salle de visio')).toBeNull()
    expect(screen.queryByText('Rejoindre la visio')).toBeNull()
  })
})
