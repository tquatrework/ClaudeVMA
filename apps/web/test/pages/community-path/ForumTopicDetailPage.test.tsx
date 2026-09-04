/**
 * Tests pour ForumTopicDetailPage — community-path-service, ajouté le 2026-09-04 (« Sujets
 * (topics) des Forums »). Porte le fil de discussion qui vivait auparavant directement sur
 * `ForumDetailPage`.
 *
 * Couvre :
 * - Chargement, sujet introuvable (404 — masquage, jamais un message qui distingue la cause)
 * - Affichage du titre et des commentaires du sujet
 * - Zone de commentaire bloquée tant que la charte n'est pas acceptée, puis débloquée après
 * - Publication d'un commentaire
 * - Bouton de suppression de commentaire visible seulement pour le RP
 * - Badge de statut pour un sujet en attente/refusé, motif de refus affiché
 * - Boutons de décision (Valider/Refuser) visibles seulement pour le RP sur un sujet en attente,
 *   jamais sur le sujet système
 * - Validation et refus d'un sujet appellent POST /forums/:id/topics/:topicId/decision
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')
vi.mock('../../../src/api/forumTopics')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchForumCharterAcceptance, acceptForumCharter } from '../../../src/api/forums'
import {
  fetchForumTopic,
  decideForumTopic,
  fetchForumTopicComments,
  createForumTopicComment,
  deleteForumTopicComment,
} from '../../../src/api/forumTopics'
import ForumTopicDetailPage from '../../../src/pages/ForumTopicDetailPage'
import type { ForumComment, ForumTopic } from '../../../src/types/forum'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForumTopic = vi.mocked(fetchForumTopic)
const mockDecideForumTopic = vi.mocked(decideForumTopic)
const mockFetchForumTopicComments = vi.mocked(fetchForumTopicComments)
const mockCreateForumTopicComment = vi.mocked(createForumTopicComment)
const mockDeleteForumTopicComment = vi.mocked(deleteForumTopicComment)
const mockFetchForumCharterAcceptance = vi.mocked(fetchForumCharterAcceptance)
const mockAcceptForumCharter = vi.mocked(acceptForumCharter)

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

const VALIDATED_TOPIC: ForumTopic = {
  id: 'topic-1',
  forumId: 'forum-1',
  title: 'Question sur les intégrales',
  authorId: 'student-1',
  authorRole: 'eleve',
  status: 'validated',
  isDefault: false,
  validatedByUserId: 'rp-1',
  validatedAt: '2026-09-04T00:00:00Z',
  rejectedByUserId: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-06-18T10:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
}

const PENDING_TOPIC: ForumTopic = {
  ...VALIDATED_TOPIC,
  status: 'pending_validation',
  validatedByUserId: null,
  validatedAt: null,
}

const REJECTED_TOPIC: ForumTopic = {
  ...VALIDATED_TOPIC,
  status: 'rejected',
  validatedByUserId: null,
  validatedAt: null,
  rejectedByUserId: 'rp-1',
  rejectedAt: '2026-09-04T00:00:00Z',
  rejectionReason: 'Hors sujet du forum.',
}

const DEFAULT_TOPIC: ForumTopic = {
  ...VALIDATED_TOPIC,
  isDefault: true,
  title: 'Sujet général',
}

const COMMENT: ForumComment = {
  id: 'comment-1',
  topicId: 'topic-1',
  authorId: 'other-user',
  authorRole: 'eleve',
  content: 'Merci pour ce sujet !',
  createdAt: '2026-06-18T10:00:00Z',
}

function renderPage(forumId = 'forum-1', topicId = 'topic-1') {
  return render(
    <MemoryRouter initialEntries={[`/community/forums/${forumId}/topics/${topicId}`]}>
      <Routes>
        <Route
          path="/community/forums/:forumId/topics/:topicId"
          element={<ForumTopicDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchForumTopic.mockResolvedValue(VALIDATED_TOPIC)
  mockFetchForumTopicComments.mockResolvedValue({
    data: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  mockFetchForumCharterAcceptance.mockResolvedValue({ accepted: false, acceptedAt: null })
})

describe('ForumTopicDetailPage', () => {
  it("affiche l'état de chargement initialement", () => {
    mockFetchForumTopic.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Chargement du sujet…')).toBeDefined()
  })

  it('affiche un message neutre quand le sujet est introuvable (404)', async () => {
    mockFetchForumTopic.mockRejectedValue({ response: { status: 404 } })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/n'existe pas ou n'est plus accessible/)).toBeDefined()
    })
  })

  it('affiche le titre et les commentaires du sujet', async () => {
    mockFetchForumTopicComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Question sur les intégrales')).toBeDefined()
    })
    expect(screen.getByText('Merci pour ce sujet !')).toBeDefined()
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
    mockCreateForumTopicComment.mockResolvedValue({
      id: 'comment-new',
      topicId: 'topic-1',
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
    expect(mockCreateForumTopicComment).toHaveBeenCalledWith('forum-1', 'topic-1', {
      content: 'Une contribution.',
    })
  })

  it("n'affiche pas le bouton de suppression de commentaire pour un élève", async () => {
    mockFetchForumTopicComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Merci pour ce sujet !')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })

  it('le RP peut supprimer un commentaire', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchForumTopicComments.mockResolvedValue({
      data: [COMMENT],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    })
    mockDeleteForumTopicComment.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Merci pour ce sujet !')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockDeleteForumTopicComment).toHaveBeenCalledWith('forum-1', 'topic-1', 'comment-1')
    })
  })

  it('affiche le badge "En attente de validation" pour un sujet en attente', async () => {
    mockFetchForumTopic.mockResolvedValue(PENDING_TOPIC)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('En attente de validation')).toBeDefined()
    })
  })

  it('affiche le motif de refus pour un sujet refusé', async () => {
    mockFetchForumTopic.mockResolvedValue(REJECTED_TOPIC)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Refusé')).toBeDefined()
    })
    expect(screen.getByText(/Motif du refus : Hors sujet du forum\./)).toBeDefined()
  })

  it('un élève ne voit pas les boutons de décision sur un sujet en attente', async () => {
    mockFetchForumTopic.mockResolvedValue(PENDING_TOPIC)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('En attente de validation')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /valider le sujet/i })).toBeNull()
  })

  it('le RP voit les boutons de décision sur un sujet en attente et valide', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchForumTopic.mockResolvedValue(PENDING_TOPIC)
    mockDecideForumTopic.mockResolvedValue({ ...PENDING_TOPIC, status: 'validated' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /valider le sujet/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /valider le sujet/i }))

    await waitFor(() => {
      expect(mockDecideForumTopic).toHaveBeenCalledWith('forum-1', 'topic-1', {
        decision: 'validated',
        reason: undefined,
      })
    })
    expect(screen.queryByText('En attente de validation')).toBeNull()
  })

  it('le RP refuse un sujet en attente', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchForumTopic.mockResolvedValue(PENDING_TOPIC)
    mockDecideForumTopic.mockResolvedValue({ ...PENDING_TOPIC, status: 'rejected' })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refuser le sujet/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /refuser le sujet/i }))

    await waitFor(() => {
      expect(mockDecideForumTopic).toHaveBeenCalledWith('forum-1', 'topic-1', {
        decision: 'rejected',
        reason: undefined,
      })
    })
  })

  it('le RP ne voit aucun bouton de décision sur le sujet système', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchForumTopic.mockResolvedValue(DEFAULT_TOPIC)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sujet général')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /valider le sujet/i })).toBeNull()
  })
})
