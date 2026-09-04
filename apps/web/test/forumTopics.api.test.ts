/**
 * Tests du transport HTTP des Sujets (topics) et commentaires de forum
 * (`src/api/forumTopics.ts`) — contrat exact de `docs/routes.md` § « community-path-service » >
 * « Sujets (topics) » (complément du 2026-09-04).
 *
 * Portée volontairement limitée : `apiClient` est simulé ici, ce fichier vérifie les chemins, les
 * paramètres et la forme du corps envoyé — pas ce qui part réellement sur le réseau.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  createForumTopic,
  fetchForumTopics,
  fetchForumTopic,
  decideForumTopic,
  fetchForumTopicComments,
  createForumTopicComment,
  deleteForumTopicComment,
} from '../src/api/forumTopics'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockDelete = vi.mocked(apiClient.delete)

const FORUM_ID = 'a1b2c3d4-0000-0000-0000-000000000001'
const TOPIC_ID = 'b1b2c3d4-0000-0000-0000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createForumTopic', () => {
  it('poste {title, content} au chemin documenté', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: TOPIC_ID,
        forumId: FORUM_ID,
        title: 'Un sujet',
        status: 'pending_validation',
        firstComment: { id: 'c1', topicId: TOPIC_ID, content: 'Premier message' },
      },
    })

    await createForumTopic(FORUM_ID, { title: 'Un sujet', content: 'Premier message' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics`, {
      title: 'Un sujet',
      content: 'Premier message',
    })
  })

  it('propage le corps structuré CHARTER_NOT_ACCEPTED', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 403,
        data: { statusCode: 403, code: 'CHARTER_NOT_ACCEPTED', message: 'x' },
      },
    })

    await expect(
      createForumTopic(FORUM_ID, { title: 'x', content: 'x' }),
    ).rejects.toMatchObject({
      response: { data: { code: 'CHARTER_NOT_ACCEPTED' } },
    })
  })
})

describe('fetchForumTopics', () => {
  it('appelle GET /forums/:id/topics avec la pagination par défaut', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 1, limit: 20, total: 0, totalPages: 1 } })

    await fetchForumTopics(FORUM_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics`, {
      params: { page: 1, limit: 20 },
    })
  })

  it('transmet page/limit explicites', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 2, limit: 50, total: 0, totalPages: 3 } })

    await fetchForumTopics(FORUM_ID, { page: 2, limit: 50 })

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics`, {
      params: { page: 2, limit: 50 },
    })
  })
})

describe('fetchForumTopic', () => {
  it('appelle GET /forums/:id/topics/:topicId', async () => {
    mockGet.mockResolvedValue({ data: { id: TOPIC_ID } })

    await fetchForumTopic(FORUM_ID, TOPIC_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}`)
  })

  it('propage un 404 (sujet inexistant ou non visible — masquage total)', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })

    await expect(fetchForumTopic(FORUM_ID, TOPIC_ID)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})

describe('decideForumTopic', () => {
  it('poste la décision au chemin documenté', async () => {
    mockPost.mockResolvedValue({ data: { id: TOPIC_ID, status: 'validated' } })

    await decideForumTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}/decision`, {
      decision: 'validated',
    })
  })

  it('transmet un motif de refus optionnel', async () => {
    mockPost.mockResolvedValue({ data: { id: TOPIC_ID, status: 'rejected' } })

    await decideForumTopic(FORUM_ID, TOPIC_ID, { decision: 'rejected', reason: 'Hors sujet' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}/decision`, {
      decision: 'rejected',
      reason: 'Hors sujet',
    })
  })

  it('propage un 403 pour un appelant non RP', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })

    await expect(
      decideForumTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' }),
    ).rejects.toMatchObject({ response: { status: 403 } })
  })

  it('propage un 400 pour le sujet système (isDefault)', async () => {
    mockPost.mockRejectedValue({ response: { status: 400 } })

    await expect(
      decideForumTopic(FORUM_ID, TOPIC_ID, { decision: 'validated' }),
    ).rejects.toMatchObject({ response: { status: 400 } })
  })
})

describe('fetchForumTopicComments', () => {
  it('appelle GET /forums/:id/topics/:topicId/comments avec la pagination par défaut', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 1, limit: 20, total: 0, totalPages: 1 } })

    await fetchForumTopicComments(FORUM_ID, TOPIC_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}/comments`, {
      params: { page: 1, limit: 20 },
    })
  })

  it('transmet page/limit explicites', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 2, limit: 50, total: 0, totalPages: 3 } })

    await fetchForumTopicComments(FORUM_ID, TOPIC_ID, { page: 2, limit: 50 })

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}/comments`, {
      params: { page: 2, limit: 50 },
    })
  })
})

describe('createForumTopicComment', () => {
  it('poste au chemin documenté', async () => {
    mockPost.mockResolvedValue({ data: { id: 'c1', topicId: TOPIC_ID, content: 'x' } })

    await createForumTopicComment(FORUM_ID, TOPIC_ID, { content: 'Un commentaire' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/topics/${TOPIC_ID}/comments`, {
      content: 'Un commentaire',
    })
  })

  it('propage le corps structuré CHARTER_NOT_ACCEPTED', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 403,
        data: { statusCode: 403, code: 'CHARTER_NOT_ACCEPTED', message: 'x' },
      },
    })

    await expect(
      createForumTopicComment(FORUM_ID, TOPIC_ID, { content: 'x' }),
    ).rejects.toMatchObject({
      response: { data: { code: 'CHARTER_NOT_ACCEPTED' } },
    })
  })
})

describe('deleteForumTopicComment', () => {
  it('appelle DELETE /forums/:id/topics/:topicId/comments/:commentId', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteForumTopicComment(FORUM_ID, TOPIC_ID, 'comment-1')

    expect(mockDelete).toHaveBeenCalledWith(
      `/forums/${FORUM_ID}/topics/${TOPIC_ID}/comments/comment-1`,
    )
  })

  it('propage un 403 pour un appelant non RP', async () => {
    mockDelete.mockRejectedValue({ response: { status: 403 } })

    await expect(
      deleteForumTopicComment(FORUM_ID, TOPIC_ID, 'comment-1'),
    ).rejects.toMatchObject({ response: { status: 403 } })
  })
})
