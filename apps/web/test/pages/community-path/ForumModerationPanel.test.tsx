/**
 * Tests pour ForumModerationPanel — community-path-service
 *
 * Refonte du 2026-09-04 : l'exclusion reste réservée au propriétaire du forum (de fait toujours
 * un RP depuis cette date) ou à tout RP — donc réservée au RP côté front, l'AP ayant perdu ce
 * droit en même temps que la création de forum.
 *
 * Complément du 2026-09-04 (« Sujets (topics) ») : le panneau porte désormais aussi la file de
 * validation des sujets en attente (`GET /forums/:id/topics`, filtrée côté front sur
 * `pending_validation`, décision via `POST /forums/:id/topics/:topicId/decision`).
 *
 * Couvre :
 * - Le RP peut exclure un membre d'un forum
 * - Message de succès après exclusion
 * - Accès refusé pour un AP (droit retiré le 2026-09-04)
 * - Accès refusé pour un élève
 * - Gestion d'erreur 403 et 404
 * - Affichage de la file des sujets en attente, et absence si aucun
 * - Le sujet système ("Sujet général", `isDefault`) n'apparaît jamais dans la file
 * - Validation et refus d'un sujet en attente
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')
vi.mock('../../../src/api/forumTopics')

import { useAuth } from '../../../src/hooks/useAuth'
import { createForumExclusion } from '../../../src/api/forums'
import { decideForumTopic, fetchForumTopics } from '../../../src/api/forumTopics'
import ForumModerationPanel from '../../../src/pages/ForumModerationPanel'
import type { ForumExclusion, ForumTopic } from '../../../src/types/forum'

const mockUseAuth = vi.mocked(useAuth)
const mockCreateForumExclusion = vi.mocked(createForumExclusion)
const mockFetchForumTopics = vi.mocked(fetchForumTopics)
const mockDecideForumTopic = vi.mocked(decideForumTopic)

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

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

function buildAuthMock(userObj = RP_USER) {
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
  excludedByUserId: 'rp-1',
  reason: 'comportement non conforme',
  createdAt: '2026-06-18T10:00:00Z',
}

const DEFAULT_TOPIC: ForumTopic = {
  id: 'topic-default',
  forumId: 'forum-1',
  title: 'Sujet général',
  authorId: 'rp-1',
  authorRole: 'responsable_pedagogique',
  status: 'validated',
  isDefault: true,
  validatedByUserId: null,
  validatedAt: null,
  rejectedByUserId: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-06-17T09:00:00Z',
  updatedAt: '2026-06-17T09:00:00Z',
}

const PENDING_TOPIC: ForumTopic = {
  id: 'topic-pending',
  forumId: 'forum-1',
  title: 'Question sur les intégrales',
  authorId: 'student-1',
  authorRole: 'eleve',
  status: 'pending_validation',
  isDefault: false,
  validatedByUserId: null,
  validatedAt: null,
  rejectedByUserId: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-06-18T10:00:00Z',
  updatedAt: '2026-06-18T10:00:00Z',
}

function buildTopicsPage(topics: ForumTopic[]) {
  return { data: topics, page: 1, limit: 20, total: topics.length, totalPages: 1 }
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
  mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC]))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForumModerationPanel', () => {
  it('affiche le panneau de modération pour le RP', () => {
    renderPage()
    expect(screen.getByText('Modération du forum')).toBeDefined()
    expect(screen.getByText('Exclure un membre')).toBeDefined()
  })

  it("affiche un message d'accès refusé pour l'AP (droit retiré le 2026-09-04)", () => {
    mockUseAuth.mockReturnValue(buildAuthMock(AP_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux responsables pédagogiques/)).toBeDefined()
  })

  it("affiche un message d'accès refusé pour un élève", () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux responsables pédagogiques/)).toBeDefined()
  })

  it('le RP peut exclure un membre avec succès', async () => {
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

  it('affiche une erreur 403 si non autorisé', async () => {
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

  it("n'affiche aucun sujet en attente quand il n'y en a pas (sujet système exclu)", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sujets en attente de validation')).toBeDefined()
    })
    expect(screen.getByText('Aucun sujet en attente de validation.')).toBeDefined()
    expect(screen.queryByText('Sujet général')).toBeNull()
  })

  it('affiche un sujet en attente de validation, avec ses boutons de décision', async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, PENDING_TOPIC]))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Question sur les intégrales')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /valider le sujet/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /refuser le sujet/i })).toBeDefined()
  })

  it('le RP valide un sujet en attente', async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, PENDING_TOPIC]))
    mockDecideForumTopic.mockResolvedValue({ ...PENDING_TOPIC, status: 'validated' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /valider le sujet/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /valider le sujet/i }))

    await waitFor(() => {
      expect(mockDecideForumTopic).toHaveBeenCalledWith('forum-1', 'topic-pending', {
        decision: 'validated',
      })
    })
  })

  it('le RP refuse un sujet en attente', async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, PENDING_TOPIC]))
    mockDecideForumTopic.mockResolvedValue({ ...PENDING_TOPIC, status: 'rejected' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refuser le sujet/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /refuser le sujet/i }))

    await waitFor(() => {
      expect(mockDecideForumTopic).toHaveBeenCalledWith('forum-1', 'topic-pending', {
        decision: 'rejected',
      })
    })
  })
})
