/**
 * Tests pour ForumDetailPage — community-path-service.
 *
 * Refonte du 2026-09-04 (« Sujets (topics) des Forums ») : l'écran devient une liste de sujets,
 * plus un fil de commentaires direct. `GET`/`POST /forums/:id/comments` n'existent plus.
 *
 * Couvre :
 * - Chargement, forum introuvable (404 — masquage, jamais un message qui distingue la cause)
 * - Affichage du forum (titre, description, tags, rôles autorisés) — plus de badges niveau/
 *   difficulté/thème/compétences, retirés le 2026-09-04
 * - Liste des sujets : vide, avec sujets, badge de statut pour un sujet en attente/refusé
 * - Un clic sur un sujet navigue vers sa page de détail
 * - Bouton "Nouveau sujet" bloqué tant que la charte n'est pas acceptée, débloqué ensuite
 * - Création d'un sujet, puis navigation vers sa page de détail
 * - Panneau d'image et lien de modération visibles seulement pour le RP
 * - Bouton "Cacher le forum" réservé au RP
 * - Édition des métadonnées d'un forum par le RP (PATCH /forums/:id)
 * - Auteur d'un sujet affiché dans la liste (prénom + nom résolus), ou « Auteur inconnu » quand
 *   `authorName` vaut `null` (2026-09-04) — jamais l'UUID `authorId`
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/forums')
vi.mock('../../../src/api/forumTopics')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  fetchForum,
  fetchForumCharterAcceptance,
  acceptForumCharter,
  fetchForumImageConstraints,
  hideForum,
  updateForum,
} from '../../../src/api/forums'
import { fetchForumTopics, createForumTopic } from '../../../src/api/forumTopics'
import ForumDetailPage from '../../../src/pages/ForumDetailPage'
import type { Forum, ForumTopic } from '../../../src/types/forum'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchForum = vi.mocked(fetchForum)
const mockFetchForumTopics = vi.mocked(fetchForumTopics)
const mockCreateForumTopic = vi.mocked(createForumTopic)
const mockFetchForumCharterAcceptance = vi.mocked(fetchForumCharterAcceptance)
const mockAcceptForumCharter = vi.mocked(acceptForumCharter)
const mockFetchForumImageConstraints = vi.mocked(fetchForumImageConstraints)
const mockHideForum = vi.mocked(hideForum)
const mockUpdateForum = vi.mocked(updateForum)

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
  tags: null,
  allowedRoles: null,
  createdById: 'rp-1',
  createdByRole: 'responsable_pedagogique',
  imageFilename: null,
  imageMimeType: null,
  isHidden: false,
  hiddenAt: null,
  hiddenByUserId: null,
  createdAt: '2026-06-17T09:00:00Z',
  updatedAt: '2026-06-17T09:00:00Z',
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
  authorName: { firstName: 'Marie', lastName: 'Responsable' },
}

const PENDING_TOPIC: ForumTopic = {
  ...DEFAULT_TOPIC,
  id: 'topic-pending',
  title: 'Question sur les intégrales',
  authorId: 'student-1',
  authorRole: 'eleve',
  status: 'pending_validation',
  isDefault: false,
  authorName: { firstName: 'Camille', lastName: 'Durand' },
}

const TOPIC_UNKNOWN_AUTHOR: ForumTopic = {
  ...PENDING_TOPIC,
  id: 'topic-unknown-author',
  title: 'Sujet sans auteur résolu',
  authorName: null,
}

function buildTopicsPage(topics: ForumTopic[]) {
  return { data: topics, page: 1, limit: 20, total: topics.length, totalPages: 1 }
}

function renderPage(forumId = 'forum-1') {
  return render(
    <MemoryRouter initialEntries={[`/community/forums/${forumId}`]}>
      <Routes>
        <Route path="/community/forums/:forumId" element={<ForumDetailPage />} />
        <Route
          path="/community/forums/:forumId/topics/:topicId"
          element={<p>Page de détail du sujet</p>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchForum.mockResolvedValue(FORUM)
  mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC]))
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

  it('affiche le titre et la description du forum', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.getByText(/Discussion autour des fonctions/)).toBeDefined()
  })

  it('affiche la liste des sujets, avec le sujet système en premier', async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, PENDING_TOPIC]))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Sujet général/)).toBeDefined()
    })
    expect(screen.getByText('Question sur les intégrales')).toBeDefined()
    expect(screen.getByText('En attente de validation')).toBeDefined()
  })

  it("affiche un message quand il n'y a aucun sujet", async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([]))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun sujet pour le moment/)).toBeDefined()
    })
  })

  it('un clic sur un sujet navigue vers sa page de détail', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Sujet général/)).toBeDefined()
    })

    const topicButton = screen.getByText(/Sujet général/).closest('button')
    expect(topicButton).not.toBeNull()
    await userEvent.click(topicButton as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Page de détail du sujet')).toBeDefined()
    })
  })

  it("bloque le bouton 'Nouveau sujet' tant que la charte n'est pas acceptée", async () => {
    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText(/devez accepter la charte de bonne conduite/),
      ).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /nouveau sujet/i })).toBeNull()
  })

  it('débloque le bouton "Nouveau sujet" après acceptation de la charte', async () => {
    mockAcceptForumCharter.mockResolvedValue({ accepted: true, acceptedAt: '2026-09-04T00:00:00Z' })
    renderPage()

    await waitFor(() => {
      screen.getByText(/devez accepter la charte de bonne conduite/)
    })

    await userEvent.click(screen.getByRole('button', { name: /j’accepte la charte/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouveau sujet/i })).toBeDefined()
    })
  })

  it('crée un sujet et navigue vers sa page de détail', async () => {
    mockFetchForumCharterAcceptance.mockResolvedValue({
      accepted: true,
      acceptedAt: '2026-09-01T00:00:00Z',
    })
    mockCreateForumTopic.mockResolvedValue({
      id: 'topic-new',
      forumId: 'forum-1',
      title: 'Nouveau sujet',
      authorId: 'student-1',
      authorRole: 'eleve',
      status: 'pending_validation',
      isDefault: false,
      validatedByUserId: null,
      validatedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      createdAt: '2026-09-04T00:00:00Z',
      updatedAt: '2026-09-04T00:00:00Z',
      firstComment: {
        id: 'c-new',
        topicId: 'topic-new',
        authorId: 'student-1',
        authorRole: 'eleve',
        content: 'Premier message',
        createdAt: '2026-09-04T00:00:00Z',
      },
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nouveau sujet/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /nouveau sujet/i }))
    await userEvent.type(screen.getByLabelText(/titre du sujet/i), 'Nouveau sujet')
    await userEvent.type(screen.getByLabelText(/votre premier message/i), 'Premier message')
    await userEvent.click(screen.getByRole('button', { name: /publier le sujet/i }))

    await waitFor(() => {
      expect(mockCreateForumTopic).toHaveBeenCalledWith('forum-1', {
        title: 'Nouveau sujet',
        content: 'Premier message',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Page de détail du sujet')).toBeDefined()
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

  it('le RP voit le bouton "Cacher le forum" et le déclenche après confirmation', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockHideForum.mockResolvedValue({ ...FORUM, isHidden: true, hiddenAt: '2026-09-04T00:00:00Z' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cacher le forum/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /cacher le forum/i }))

    await waitFor(() => {
      expect(mockHideForum).toHaveBeenCalledWith('forum-1')
    })
    expect(screen.getByText('Caché')).toBeDefined()
  })

  it("n'affiche pas le bouton 'Cacher le forum' pour un élève", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /cacher le forum/i })).toBeNull()
  })

  it("le RP peut ouvrir le formulaire d'édition, pré-rempli avec les valeurs actuelles", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /modifier le forum/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /modifier le forum/i }))

    expect(screen.getByLabelText(/titre/i)).toHaveValue('Forum Trigonométrie')
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      'Discussion autour des fonctions trigonométriques.',
    )
    expect(
      screen.getByRole('button', { name: /enregistrer les modifications/i }),
    ).toBeDefined()
  })

  it('le RP édite le forum : appelle PATCH /forums/:id et affiche la réponse du serveur', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockUpdateForum.mockResolvedValue({
      ...FORUM,
      title: 'Forum Trigonométrie (mis à jour)',
      description: 'Nouvelle description.',
    })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /modifier le forum/i })).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /modifier le forum/i }))

    const titleInput = screen.getByLabelText(/titre/i)
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Forum Trigonométrie (mis à jour)')

    await userEvent.click(screen.getByRole('button', { name: /enregistrer les modifications/i }))

    await waitFor(() => {
      expect(mockUpdateForum).toHaveBeenCalledWith(
        'forum-1',
        expect.objectContaining({ title: 'Forum Trigonométrie (mis à jour)' }),
      )
    })

    // La page réaffiche la réponse reçue du serveur, jamais le corps envoyé (règle du 2026-08-10).
    await waitFor(() => {
      expect(screen.getByText('Forum Trigonométrie (mis à jour)')).toBeDefined()
    })
    expect(screen.getByText('Nouvelle description.')).toBeDefined()
  })

  it("affiche le prénom et le nom résolus de l'auteur d'un sujet", async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, PENDING_TOPIC]))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Question sur les intégrales')).toBeDefined()
    })
    expect(screen.getByText(/Par Camille Durand/)).toBeDefined()
    expect(screen.queryByText('student-1')).toBeNull()
  })

  it("affiche « Auteur inconnu » pour un sujet dont authorName vaut null, sans jamais afficher l'UUID", async () => {
    mockFetchForumTopics.mockResolvedValue(buildTopicsPage([DEFAULT_TOPIC, TOPIC_UNKNOWN_AUTHOR]))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Sujet sans auteur résolu')).toBeDefined()
    })
    expect(screen.getByText(/Par Auteur inconnu/)).toBeDefined()
    expect(screen.queryByText('student-1')).toBeNull()
  })
})
