/**
 * Tests pour VideoPage — video-session-service
 *
 * Couvre :
 * 1. Chargement puis affichage de la salle (succès)
 * 2. États d'erreur de chargement (403 / 404 / générique)
 * 3. Rejoindre la visio (redirection) avec enregistrement de présence non-bloquant :
 *    l'échec de l'enregistrement de présence n'empêche pas la redirection mais reste visible.
 * 4. Enregistrer la présence explicitement (bouton dédié)
 * 5. Clôturer la session (rôles autorisés uniquement)
 * 6. Boutons Mémo / Clôturer visibles selon le rôle
 *
 * `RecordingListPanel` et `CourseSummaryView` (dépendances non migrées dans ce lot) mockent
 * `src/api/client` uniquement pour éviter tout appel réseau réel pendant ces tests, sans
 * changer leur comportement.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import VideoPage from '../../src/pages/VideoPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/video')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import { fetchRoomInfo, joinRoom, recordAttendance, closeRoom } from '../../src/api/video'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchRoomInfo = vi.mocked(fetchRoomInfo)
const mockJoinRoom = vi.mocked(joinRoom)
const mockRecordAttendance = vi.mocked(recordAttendance)
const mockCloseRoom = vi.mocked(closeRoom)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
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

function renderVideoPage(roomId = 'room-abc') {
  return render(
    <MemoryRouter initialEntries={[`/video/${roomId}`]}>
      <Routes>
        <Route path="/video/:roomId" element={<VideoPage />} />
        <Route path="/dashboard" element={<div>DashboardPage</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Dépendances non migrées (RecordingListPanel, CourseSummaryView) — évite tout appel réseau réel.
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
})

// ---------------------------------------------------------------------------
// Test 1 — Chargement puis affichage de la salle
// ---------------------------------------------------------------------------
describe('VideoPage — chargement de la salle', () => {
  it('affiche le chargement puis la salle active', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({
      id: 'room-abc',
      status: 'active',
      participants: ['user-1', 'user-2'],
    })

    renderVideoPage()

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    expect(mockFetchRoomInfo).toHaveBeenCalledWith('room-abc')
    expect(screen.getByText('Participants (2)')).toBeDefined()
  })

  it('affiche une erreur 403 lors du chargement', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockRejectedValue({ response: { status: 403 } })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas autorisé à rejoindre cette salle")).toBeDefined()
    })
  })

  it('affiche une erreur 404 lors du chargement', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockRejectedValue({ response: { status: 404 } })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByText('Salle introuvable')).toBeDefined()
    })
  })

  it('affiche une erreur générique sur échec réseau', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockRejectedValue(new Error('boom'))

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement de la salle')).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Rejoindre la visio : présence non-bloquante mais visible
// ---------------------------------------------------------------------------
describe('VideoPage — rejoindre la visio', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // jsdom n'implémente pas la navigation — on remplace window.location pour observer
    // l'affectation de href sans déclencher d'erreur "Not implemented: navigation".
    // @ts-expect-error — remplacement volontaire pour le test
    delete window.location
    // @ts-expect-error — objet minimal suffisant pour l'assertion
    window.location = { href: '' }
  })

  afterEach(() => {
    window.location = originalLocation
  })

  it('redirige vers joinUrl et enregistre la présence en arrière-plan', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ joinUrl: 'https://meet.example.com/room-abc' })
    mockRecordAttendance.mockResolvedValue(undefined)

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    await waitFor(() => {
      expect(window.location.href).toBe('https://meet.example.com/room-abc')
    })

    expect(mockJoinRoom).toHaveBeenCalledWith('room-abc')
    expect(mockRecordAttendance).toHaveBeenCalledWith('room-abc', {
      userId: 'student-1',
      joinedAt: expect.any(String),
    })
  })

  it("rend visible l'échec d'enregistrement de présence sans bloquer la redirection", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ joinUrl: 'https://meet.example.com/room-abc' })
    mockRecordAttendance.mockRejectedValue(new Error('network down'))

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    // La redirection a bien eu lieu malgré l'échec de l'enregistrement de présence.
    await waitFor(() => {
      expect(window.location.href).toBe('https://meet.example.com/room-abc')
    })

    // Et l'échec n'est plus avalé silencieusement : il est affiché.
    await waitFor(() => {
      expect(screen.getByText("Erreur lors de l'enregistrement de la présence")).toBeDefined()
    })
  })

  it('affiche une erreur si joinRoom échoue (403) et ne redirige pas', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockRejectedValue({ response: { status: 403 } })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas autorisé à effectuer cette action.")).toBeDefined()
    })

    expect(window.location.href).toBe('')
    expect(mockRecordAttendance).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Enregistrer la présence explicitement
// ---------------------------------------------------------------------------
describe('VideoPage — enregistrer la présence', () => {
  it('affiche un message de succès après enregistrement explicite', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockRecordAttendance.mockResolvedValue(undefined)

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enregistrer ma présence/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer ma présence/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Présence enregistrée').length).toBeGreaterThanOrEqual(1)
    })

    expect(mockRecordAttendance).toHaveBeenCalledWith('room-abc', {
      userId: 'student-1',
      joinedAt: expect.any(String),
    })
  })

  it("affiche une erreur si l'enregistrement de présence échoue", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockRecordAttendance.mockRejectedValue({ response: { data: { message: 'Salle fermée' } } })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enregistrer ma présence/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /enregistrer ma présence/i }))

    await waitFor(() => {
      expect(screen.getByText('Salle fermée')).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 4 — Clôturer la session (rôle-dépendant)
// ---------------------------------------------------------------------------
describe('VideoPage — clôturer la session', () => {
  it('affiche le bouton Clôturer pour un formateur et clôture après confirmation', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockCloseRoom.mockResolvedValue(undefined)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clôturer la session/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /clôturer la session/i }))

    await waitFor(() => {
      expect(screen.getByText('Session clôturée')).toBeDefined()
    })

    expect(mockCloseRoom).toHaveBeenCalledWith('room-abc')
    expect(screen.getByText('Terminée')).toBeDefined()

    confirmSpy.mockRestore()
  })

  it('ne clôture pas si la confirmation est annulée', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clôturer la session/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /clôturer la session/i }))

    expect(mockCloseRoom).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it("n'affiche pas le bouton Clôturer pour un élève", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /clôturer la session/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 5 — Bouton Mémo selon le rôle
// ---------------------------------------------------------------------------
describe('VideoPage — bouton Mémo', () => {
  it('affiche le bouton Mémo pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Ouvrir le mémo')).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 6 — Salle terminée : lien vers l'activité
// ---------------------------------------------------------------------------
describe('VideoPage — salle terminée', () => {
  it("affiche un lien vers l'activité si la salle est terminée", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'ended', activityId: 'activity-1' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByText("Voir le détail de l'activité")).toBeDefined()
    })
  })
})
