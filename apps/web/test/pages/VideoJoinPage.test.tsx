/**
 * Tests pour VideoJoinPage — Phase 5 (video-session-service)
 *
 * Couvre :
 * 1. Élève ouvre la page de join depuis un événement calendrier
 * 2. Formateur ouvre la page de join pour sa propre session
 * 3. Parent ne peut pas accéder à la vue
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import VideoJoinPage from '../../src/pages/VideoJoinPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

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
  it('affiche le bouton Rejoindre et appelle GET /video/rooms/:id/join', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockApiClient.get = vi.fn()
      .mockResolvedValueOnce({
        data: { id: 'room-abc', status: 'active', calendarSessionId: 'cal-session-1' },
      })
      .mockResolvedValueOnce({
        data: { joinUrl: 'https://meet.example.com/room-abc', token: 'tok-xyz' },
      })

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.queryByText("Vous n'avez pas accès à cette session vidéo")).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /rejoindre/i }))

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/video/rooms/room-abc/join')
    })

    expect(openSpy).toHaveBeenCalledWith('https://meet.example.com/room-abc', '_blank')

    openSpy.mockRestore()
  })

  it('affiche le chargement puis la vue de la salle', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockApiClient.get = vi.fn().mockResolvedValue({
      data: { id: 'room-abc', status: 'active' },
    })

    renderVideoJoinPage('room-abc')

    expect(screen.getByText('Chargement…')).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Formateur ouvre la page de join pour sa propre session
// ---------------------------------------------------------------------------
describe('VideoJoinPage — formateur gère sa session', () => {
  it('affiche le bouton Rejoindre ET le lien Clôturer pour un formateur', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    mockApiClient.get = vi.fn().mockResolvedValue({
      data: { id: 'room-abc', status: 'active' },
    })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.getByText('Clôturer la session')).toBeDefined()
  })

  it("n'affiche pas le lien Clôturer pour un élève", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))

    mockApiClient.get = vi.fn().mockResolvedValue({
      data: { id: 'room-abc', status: 'active' },
    })

    renderVideoJoinPage('room-abc')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /rejoindre/i })).toBeDefined()
    })

    expect(screen.queryByText('Clôturer la session')).toBeNull()
  })

  it('affiche un lien vers les enregistrements quand la room est ended', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    mockApiClient.get = vi.fn().mockResolvedValue({
      data: { id: 'room-abc', status: 'ended' },
    })

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

    mockApiClient.get = vi.fn()

    renderVideoJoinPage('room-abc')

    expect(
      screen.getByText("Vous n'avez pas accès à cette session vidéo"),
    ).toBeDefined()

    expect(mockApiClient.get).not.toHaveBeenCalled()
  })
})
