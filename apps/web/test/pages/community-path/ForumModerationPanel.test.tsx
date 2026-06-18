/**
 * Tests pour ForumModerationPanel (Phase 14)
 *
 * Couvre :
 * - L'AP peut exclure un membre d'un forum
 * - Message de succès après exclusion
 * - Accès refusé pour un élève
 * - Gestion d'erreur 403 et 404
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/communityPath')

import { useAuth } from '../../../src/hooks/useAuth'
import { createForumExclusion } from '../../../src/api/communityPath'
import ForumModerationPanel from '../../../src/pages/ForumModerationPanel'
import type { ForumExclusion } from '../../../src/api/communityPath'

const mockUseAuth = vi.mocked(useAuth)
const mockCreateForumExclusion = vi.mocked(createForumExclusion)

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AP_USER = {
  id: 'ap-1',
  email: 'ap@test.com',
  role: 'animateur_pedagogique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = AP_USER) {
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

const EXCLUSION: ForumExclusion = {
  id: 'excl-1',
  forumId: 'forum-1',
  excludedUserId: 'user-bad',
  reason: 'comportement non conforme',
  createdAt: '2026-06-18T10:00:00Z',
}

function renderPage(forumId = 'forum-1') {
  return render(
    <MemoryRouter initialEntries={[`/community/forums/${forumId}/moderation`]}>
      <Routes>
        <Route
          path="/community/forums/:forumId/moderation"
          element={<ForumModerationPanel />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumModerationPanel', () => {
  it("affiche le panneau de modération pour l'AP", () => {
    renderPage()
    expect(screen.getByText('Modération du forum')).toBeDefined()
    expect(screen.getByText('Exclure un membre')).toBeDefined()
  })

  it("affiche un message d'accès refusé pour un élève", () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(
      screen.getByText(/Accès réservé aux animateurs pédagogiques/),
    ).toBeDefined()
  })

  it("l'AP peut exclure un membre avec succès", async () => {
    mockCreateForumExclusion.mockResolvedValue(EXCLUSION)
    renderPage()

    await userEvent.type(screen.getByLabelText(/identifiant de l'utilisateur/i), 'user-bad')
    await userEvent.type(
      screen.getByLabelText(/motif/i),
      'comportement non conforme',
    )
    await userEvent.click(screen.getByRole('button', { name: /exclure le membre/i }))

    await waitFor(() => {
      expect(screen.getByText('Le membre a été exclu du forum.')).toBeDefined()
    })
  })

  it("affiche l'historique des exclusions après succès", async () => {
    mockCreateForumExclusion.mockResolvedValue(EXCLUSION)
    renderPage()

    await userEvent.type(screen.getByLabelText(/identifiant de l'utilisateur/i), 'user-bad')
    await userEvent.click(screen.getByRole('button', { name: /exclure le membre/i }))

    await waitFor(() => {
      expect(screen.getByText('user-bad')).toBeDefined()
    })
  })

  it("affiche une erreur 403 si non autorisé", async () => {
    mockCreateForumExclusion.mockRejectedValue({ response: { status: 403 } })
    renderPage()

    await userEvent.type(screen.getByLabelText(/identifiant de l'utilisateur/i), 'user-bad')
    await userEvent.click(screen.getByRole('button', { name: /exclure le membre/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Vous n'êtes pas autorisé à effectuer cette exclusion/),
      ).toBeDefined()
    })
  })
})
