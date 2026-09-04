/**
 * Tests pour ForumDetailPage — community-path-service, refonte du 2026-09-04.
 *
 * `GET /forums/:id` et `GET /forums/:id/comments` sont de vraies routes depuis cette date —
 * l'ancien écran ne les appelait pas du tout (fil de discussion purement local).
 *
 * Couvre :
 * - Chargement, forum introuvable (404 — masquage, jamais un message qui distingue la cause)
 * - Affichage du forum et de ses commentaires
 * - Zone de commentaire bloquée tant que la charte n'est pas acceptée, puis débloquée après
 * - Publication d'un commentaire
 * - Bouton de suppression de commentaire visible seulement pour le RP
 * - Panneau d'image et lien de modération visibles seulement pour le RP
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  fetchForum,
  fetchForumComments,
  fetchForumCharterAcceptance,
  acceptForumCharter,
  createForumComment,
  deleteForumComment,
  fetchForumImageConstraints,
} from '../../../src/api/forums'
import ForumDetailPage from '../../../src/pages/ForumDetailPage'
import type { Forum, ForumComment } from '../../../src/types/forum'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForum = vi.mocked(fetchForum)
const mockFetchForumComments = vi.mocked(fetchForumComments)
const mockFetchForumCharterAcceptance = vi.mocked(fetchForumCharterAcceptance)
const mockAcceptForumCharter = vi.mocked(acceptForumCharter)
const mockCreateForumComment = vi.mocked(createForumComment)
const mockDeleteForumComment = vi.mocked(deleteForumComment)
const mockFetchForumImageConstraints = vi.mocked(fetchForumImageConstraints)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
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

const FORUM: Forum = {
  id: 'forum-1',
  title: 'Forum Trigonométrie',
  description: 'Discussion autour des fonctions trigonométriques.',
  level: null,
  difficulty: null,
  theme: null,
  competences: null,
  tags: null,
  allowedRoles: null,
  createdById: 'rp-1',
  createdByRole: 'responsable_pedagogique',
  imageFilename: null,
  imageMimeType: null,
  createdAt: '2026-06-17T09:00:00Z',
  updatedAt: '2026-06-17T09:00:00Z',
}

const COMMENT: ForumComment = {
  id: 'comment-1',
  forumId: 'forum-1',
  authorId: 'other-user',
  authorRole: 'eleve',
  content: 'Merci pour ce forum !',
  createdAt: '2026-06-18T10:00:00Z',
}

function renderPage(forumId = 'forum-1') {
  return render(
    <MemoryRouter initialEntries={[`/community/forums/${forumId}`]}>
      <Routes>
        <Route path="/community/forums/:forumId" element={<ForumDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchForum.mockResolvedValue(FORUM)
  mockFetchForumComments.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0, totalPages: 1 })
  mockFetchForumCharterAcceptance.mockResolvedValue({ accepted: false, acceptedAt: null })
  mockFetchForumImageConstraints.mockResolvedValue({
    maxSizeBytes: 1_000_000,
    allowedMimeTypes: ['image/jpeg'],
  })
})

describe('ForumDetailPage', () => {
  it("affiche l'état de chargement initialement", () => {
    mockFetchForum.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement du forum…')).toBeDefined()
  })

  it('affiche un message neutre quand le forum est introuvable (404)', async () => {
    mockFetchForum.mockRejectedValue({ response: { status: 404 } })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/n'existe pas ou n'est plus accessible/)).toBeDefined()
    })
  })

  it('affiche le titre, la description et les commentaires du forum', async () => {
    mockFetchForumComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.getByText(/Discussion autour des fonctions/)).toBeDefined()
    expect(screen.getByText('Merci pour ce forum !')).toBeDefined()
  })

  it("bloque la zone de commentaire tant que la charte n'est pas acceptée", async () => {
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText(/devez accepter la charte de bonne conduite/),
      ).toBeDefined()
    })
    expect(screen.queryByLabelText(/votre commentaire/i)).toBeNull()
  })

  it('débloque la zone de commentaire après acceptation de la charte', async () => {
    mockAcceptForumCharter.mockResolvedValue({ accepted: true, acceptedAt: '2026-09-04T00:00:00Z' })
    renderPage()

    await waitFor(() => {
      screen.getByText(/devez accepter la charte de bonne conduite/)
    })

    await userEvent.click(screen.getByRole('button', { name: /j’accepte la charte/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/votre commentaire/i)).toBeDefined()
    })
  })

  it('publie un commentaire quand la charte est déjà acceptée', async () => {
    mockFetchForumCharterAcceptance.mockResolvedValue({
      accepted: true,
      acceptedAt: '2026-09-01T00:00:00Z',
    })
    mockCreateForumComment.mockResolvedValue({
      id: 'comment-new',
      forumId: 'forum-1',
      authorId: 'student-1',
      authorRole: 'eleve',
      content: 'Une contribution.',
      createdAt: '2026-09-04T00:00:00Z',
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/votre commentaire/i)).toBeDefined()
    })

    await userEvent.type(screen.getByLabelText(/votre commentaire/i), 'Une contribution.')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(screen.getByText('Une contribution.')).toBeDefined()
    })
  })

  it("n'affiche pas le bouton de suppression de commentaire pour un élève", async () => {
    mockFetchForumComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Merci pour ce forum !')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })

  it('le RP peut supprimer un commentaire', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchForumComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    mockDeleteForumComment.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Merci pour ce forum !')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockDeleteForumComment).toHaveBeenCalledWith('forum-1', 'comment-1')
    })
  })

  it("affiche le panneau d'image et le lien de modération pour le RP uniquement", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Image d'illustration")).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /ouvrir le panneau de modération/i })).toBeDefined()
  })

  it("n'affiche ni panneau d'image ni lien de modération pour un élève", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.queryByText("Image d'illustration")).toBeNull()
    expect(screen.queryByRole('button', { name: /ouvrir le panneau de modération/i })).toBeNull()
  })
})
