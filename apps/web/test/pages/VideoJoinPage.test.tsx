/**
 * Tests pour VideoJoinPage — Phase 5 (video-session-service)
 *
 * Couvre :
 * 1. Élève ouvre la page de join depuis un événement calendrier
 * 2. Formateur ouvre la page de join pour sa propre session
 * 3. Parent ne peut pas accéder à la vue
 * 4. Chargement puis erreur (403/404/générique)
 * 5. Rejoindre monte l'appel vidéo intégré (LiveVideoCall) avec le token/l'URL LiveKit réels,
 *    au lieu de l'ancien `window.open(joinUrl)` (chantier calendrier-visio-livekit, point 4).
 *
 * `LiveVideoCall` est mocké : son propre comportement (connexion LiveKit réelle, gestion des
 * erreurs de certificat) est couvert par test/components/video/LiveVideoCall.test.tsx. Ici on
 * vérifie seulement que VideoJoinPage lui transmet le bon token/url et gère `onLeave`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VideoJoinPage from '../../src/pages/VideoJoinPage'

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

import { useAuth } from '../../src/hooks/useAuth'
import { fetchRoomInfo, joinRoom } from '../../src/api/video'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchRoomInfo = vi.mocked(fetchRoomInfo)
const mockJoinRoom = vi.mocked(joinRoom)

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

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
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

function renderVideoJoinPage(roomId = 'room-abc') {
  return render(
    <MemoryRouter initialEntries={[`/video-join/${roomId}`]}>
      <Routes>
        <Route path="/video-join/:roomId" element={<VideoJoinPage />} />
        <Route path="/video/:roomId" element={<div>VideoPage</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Test 1 — Élève ouvre la page de join depuis un événement calendrier
// ---------------------------------------------------------------------------
describe('VideoJoinPage — élève rejoint depuis un événement calendrier', () => {
  it('affiche le bouton Rejoindre et monte l’appel vidéo intégré avec le token/url LiveKit', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockResolvedValue({
      id: 'room-abc',
      status: 'active',
      calendarSessionId: 'cal-session-1',
    })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.queryByText("Vous n'avez pas accès à cette session vidéo")).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }))

    await waitFor(() => {
      expect(mockJoinRoom).toHaveBeenCalledWith('room-abc')
    })

    await waitFor(() => {
      expect(screen.getByTestId('live-video-call')).toBeDefined()
    })
    expect(screen.getByText('token: tok-xyz')).toBeDefined()
    expect(screen.getByText('url: wss://livekit.example.com')).toBeDefined()
  })

  it('affiche le chargement puis la vue de la salle', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoJoinPage('room-abc')

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement de la salle échoue (générique)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockRejectedValue(new Error('network down'))

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement de la salle')).toBeDefined()
    })
  })

  it('affiche une erreur 404 si la salle est introuvable', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockRejectedValue({ response: { status: 404 } })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByText('Salle introuvable')).toBeDefined()
    })
  })

  it("affiche une erreur si rejoindre la salle échoue (403)", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockRejectedValue({ response: { status: 403 } })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }))

    await waitFor(() => {
      expect(screen.getByText("Vous n'êtes pas autorisé à effectuer cette action.")).toBeDefined()
    })

    expect(screen.queryByTestId('live-video-call')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 1bis — Salle fraîchement créée, statut `waiting` (bug réel du 2026-08-19 :
// aucun bouton Rejoindre ne s'affichait, verrouillant définitivement la salle — le seul appel
// qui fait passer WAITING → ACTIVE côté serveur est précisément GET /video/rooms/:id/join, que
// ce bouton absent devait déclencher).
// ---------------------------------------------------------------------------
describe('VideoJoinPage — salle fraîchement créée (status waiting)', () => {
  it('affiche le bouton Rejoindre pour une salle waiting, comme pour une salle active', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'waiting' })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }))

    await waitFor(() => {
      expect(mockJoinRoom).toHaveBeenCalledWith('room-abc')
    })

    await waitFor(() => {
      expect(screen.getByTestId('live-video-call')).toBeDefined()
    })
    expect(screen.getByText('token: tok-xyz')).toBeDefined()
    expect(screen.getByText('url: wss://livekit.example.com')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Formateur ouvre la page de join pour sa propre session
// ---------------------------------------------------------------------------
describe('VideoJoinPage — formateur gère sa session', () => {
  it('affiche le bouton Rejoindre ET le lien Clôturer pour un formateur', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.getByText('Clôturer la session')).toBeDefined()
  })

  it("n'affiche pas le lien Clôturer pour un élève", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.queryByText('Clôturer la session')).toBeNull()
  })

  it('affiche un lien vers les enregistrements quand la room est ended', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'ended' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByText('Voir les enregistrements')).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /rejoindre/i })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Parent ne peut pas accéder à la vue visio
// ---------------------------------------------------------------------------
describe('VideoJoinPage — accès parent refusé', () => {
  it("affiche le message d'accès refusé pour parent_financeur sans appel API", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))

    renderVideoJoinPage('room-abc')

    expect(
      screen.getByText("Vous n'avez pas accès à cette session vidéo"),
    ).toBeDefined()

    expect(mockFetchRoomInfo).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Test 5 — Quitter l'appel ramène à un état cohérent (pas une déconnexion silencieuse)
// ---------------------------------------------------------------------------
describe('VideoJoinPage — quitter l’appel', () => {
  it('revient à la vue de la salle (bouton Rejoindre à nouveau visible) après avoir quitté', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchRoomInfo.mockResolvedValue({ id: 'room-abc', status: 'active' })
    mockJoinRoom.mockResolvedValue({ token: 'tok-xyz', url: 'wss://livekit.example.com' })

    renderVideoJoinPage('room-abc')

    await waitFor(() => screen.getByRole('button', { name: /rejoindre/i }))
    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }))

    await waitFor(() => screen.getByTestId('live-video-call'))

    // Le bouton "Quitter" de l'entête de page, exact — distinct du bouton du mock LiveVideoCall
    // ("Quitter l'appel (mock)") qui exerce le chemin `onLeave` de la librairie elle-même.
    await userEvent.click(screen.getByRole('button', { name: 'Quitter' }))

    await waitFor(() => {
      expect(screen.queryByTestId('live-video-call')).toBeNull()
    })
    expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
  })
})
