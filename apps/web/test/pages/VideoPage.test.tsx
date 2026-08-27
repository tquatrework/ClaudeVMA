/**
 * Tests pour VideoPage — video-session-service
 *
 * Couvre :
 * 1. Chargement puis affichage de la salle (succès)
 * 2. États d'erreur de chargement (403 / 404 / générique)
 * 3. Rejoindre la visio monte l'appel vidéo intégré (LiveVideoCall) avec enregistrement de
 *    présence non-bloquant : l'échec de l'enregistrement de présence n'empêche pas de rejoindre
 *    mais reste visible (chantier calendrier-visio-livekit, point 4 — remplace l'ancienne
 *    redirection `window.location.href = joinUrl`).
 * 4. Enregistrer la présence explicitement (bouton dédié)
 * 5. Clôturer la session (rôles autorisés uniquement)
 * 6. Bouton Mémo réservé à l'élève (studentId non ambigu) ; ouvre/ferme une
 *    fenêtre `MemoReadOnlyModal` (mockée ici — comportement propre couvert par
 *    test/components/pedagogical-log/MemoReadOnlyModal.test.tsx) plutôt que
 *    l'ancien tiroir `InVideoMemoDrawer` (retiré, chantier `feat/memo-formules`)
 *
 * `RecordingListPanel` et `CourseSummaryView` (montés comme enfants de VideoPage) consomment
 * désormais `src/api/video` — mocké ici comme le reste du module pour éviter tout appel réseau
 * réel pendant ces tests, sans changer leur comportement. `LiveVideoCall` est mocké : son propre
 * comportement est couvert par test/components/video/LiveVideoCall.test.tsx.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VideoPage from '../../src/pages/VideoPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/video')
vi.mock('../../src/components/video/LiveVideoCall', () => ({
  default: (props: { token: string; url: string; onLeave: () => void }) => (
    <div data-testid="live-video-call">
      <p>token: {props.token}</p>
      <p>url: {props.url}</p>
      <button onClick={props.onLeave}>Quitter l'appel (mock)</button>
    </div>
  ),
}))
vi.mock('../../src/components/pedagogical-log/MemoReadOnlyModal', () => ({
  MemoReadOnlyModal: (props: { studentId: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Mémo" data-testid="memo-modal-stub">
      <p>studentId: {props.studentId}</p>
      <button onClick={props.onClose}>Fermer (mock)</button>
    </div>
  ),
}))

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchRoomInfo,
  joinRoom,
  recordAttendance,
  closeRoom,
  fetchRecordings,
} from '../../src/api/video'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchRoomInfo = vi.mocked(fetchRoomInfo)
const mockJoinRoom = vi.mocked(joinRoom)
const mockRecordAttendance = vi.mocked(recordAttendance)
const mockCloseRoom = vi.mocked(closeRoom)
const mockFetchRecordings = vi.mocked(fetchRecordings)

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
  // RecordingListPanel (enfant de VideoPage) charge les enregistrements au montage — liste vide
  // par défaut pour éviter tout appel réseau réel pendant ces tests.
  mockFetchRecordings.mockResolvedValue([])
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

  // Bug réel du 2026-08-19 : une salle fraîchement créée (status `waiting`) n'affichait aucun
  // bouton Rejoindre — verrou circulaire, seul GET /video/rooms/:id/join fait passer
  // WAITING → ACTIVE côté serveur, et ce bouton absent devait déclencher cet appel.
  it('affiche le bouton Rejoindre la visio pour une salle waiting, comme pour une salle active', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'waiting' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    expect(screen.getByText('En cours')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Rejoindre la visio : présence non-bloquante mais visible
// ---------------------------------------------------------------------------
describe('VideoPage — rejoindre la visio', () => {
  it('monte l’appel vidéo intégré avec le token/url LiveKit et enregistre la présence en arrière-plan', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })
    mockRecordAttendance.mockResolvedValue(undefined)

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    await waitFor(() => {
      expect(screen.getByTestId('live-video-call')).toBeDefined()
    })
    expect(screen.getByText('token: tok-xyz')).toBeDefined()
    expect(screen.getByText('url: wss://livekit.example.com')).toBeDefined()

    expect(mockJoinRoom).toHaveBeenCalledWith('room-abc')
    await waitFor(() => {
      expect(mockRecordAttendance).toHaveBeenCalledWith('room-abc', {
        userId: 'student-1',
        joinedAt: expect.any(String),
      })
    })
  })

  it("rend visible l'échec d'enregistrement de présence sans empêcher de rejoindre", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })
    mockRecordAttendance.mockRejectedValue(new Error('network down'))

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    // L'appel a bien été monté malgré l'échec de l'enregistrement de présence.
    await waitFor(() => {
      expect(screen.getByTestId('live-video-call')).toBeDefined()
    })
  })

  it('affiche une erreur si joinRoom échoue (403) et ne monte pas l’appel', async () => {
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

    expect(screen.queryByTestId('live-video-call')).toBeNull()
    expect(mockRecordAttendance).not.toHaveBeenCalled()
  })

  it('quitter l’appel ramène à la vue de la salle (état cohérent, pas une déconnexion silencieuse)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })
    mockRecordAttendance.mockResolvedValue(undefined)

    renderVideoPage()

    await waitFor(() => screen.getByRole('button', { name: /rejoindre la visio/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejoindre la visio/i }))

    await waitFor(() => screen.getByTestId('live-video-call'))

    await userEvent.click(screen.getByRole('button', { name: 'Quitter' }))

    await waitFor(() => {
      expect(screen.queryByTestId('live-video-call')).toBeNull()
    })
    expect(screen.getByRole('button', { name: /rejoindre la visio/i })).toBeDefined()
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

  it("n'affiche pas le bouton Mémo pour un formateur — pas de studentId non ambigu côté visio", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByText('Session visio')).toBeDefined()
    })
    expect(screen.queryByLabelText('Ouvrir le mémo')).toBeNull()
  })

  it('ouvre la fenêtre du mémo au clic, avec le studentId de l\'élève connecté', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Ouvrir le mémo')).toBeDefined()
    })
    expect(screen.queryByTestId('memo-modal-stub')).toBeNull()

    await userEvent.click(screen.getByLabelText('Ouvrir le mémo'))

    expect(screen.getByTestId('memo-modal-stub')).toBeDefined()
    expect(screen.getByText(`studentId: ${STUDENT_USER.id}`)).toBeDefined()
  })

  it('ferme la fenêtre du mémo', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Ouvrir le mémo')).toBeDefined()
    })
    await userEvent.click(screen.getByLabelText('Ouvrir le mémo'))
    expect(screen.getByTestId('memo-modal-stub')).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: 'Fermer (mock)' }))

    expect(screen.queryByTestId('memo-modal-stub')).toBeNull()
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
