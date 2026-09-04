/**
 * Tests du transport HTTP des Forums (`src/api/forums.ts`) — contrat exact de
 * `docs/routes.md` § « community-path-service » (refonte du 2026-09-04).
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
  fetchForums,
  fetchForum,
  createForum,
  hideForum,
  fetchForumComments,
  createForumComment,
  deleteForumComment,
  fetchForumCharter,
  updateForumCharter,
  fetchForumCharterAcceptance,
  acceptForumCharter,
  fetchForumImageConstraints,
  uploadForumImage,
  fetchForumImageBlob,
  createForumExclusion,
} from '../src/api/forums'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)
const mockDelete = vi.mocked(apiClient.delete)

const FORUM_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchForums', () => {
  it('appelle GET /forums avec le filtre tags', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await fetchForums({ tags: 'algebre,trigo' })

    expect(mockGet).toHaveBeenCalledWith('/forums', { params: { tags: 'algebre,trigo' } })
  })

  it('renvoie directement le tableau, pas une enveloppe paginée', async () => {
    mockGet.mockResolvedValue({ data: [{ id: FORUM_ID }] })

    const result = await fetchForums()

    expect(result).toEqual([{ id: FORUM_ID }])
  })

  it('appelle GET /forums avec mine=true, combinable avec tags', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await fetchForums({ tags: 'algebre', mine: true })

    expect(mockGet).toHaveBeenCalledWith('/forums', { params: { tags: 'algebre', mine: true } })
  })
})

describe('hideForum', () => {
  it('appelle POST /forums/:id/hide sans body', async () => {
    mockPost.mockResolvedValue({ data: { id: FORUM_ID, isHidden: true } })

    const result = await hideForum(FORUM_ID)

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/hide`)
    expect(result).toEqual({ id: FORUM_ID, isHidden: true })
  })

  it('propage un 403 pour un appelant non RP', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })

    await expect(hideForum(FORUM_ID)).rejects.toMatchObject({ response: { status: 403 } })
  })
})

describe('fetchForum', () => {
  it('appelle GET /forums/:id', async () => {
    mockGet.mockResolvedValue({ data: { id: FORUM_ID } })

    await fetchForum(FORUM_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}`)
  })

  it('propage un 404 (forum inexistant ou rôle non autorisé — masquage total)', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })

    await expect(fetchForum(FORUM_ID)).rejects.toMatchObject({ response: { status: 404 } })
  })
})

describe('createForum', () => {
  it('poste le corps documenté à POST /forums', async () => {
    mockPost.mockResolvedValue({ data: { id: FORUM_ID, title: 'Forum test' } })

    await createForum({ title: 'Forum test', allowedRoles: ['eleve'] })

    expect(mockPost).toHaveBeenCalledWith('/forums', {
      title: 'Forum test',
      allowedRoles: ['eleve'],
    })
  })

  it('propage un 403 pour un appelant non RP', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })

    await expect(createForum({ title: 'x' })).rejects.toMatchObject({ response: { status: 403 } })
  })
})

describe('fetchForumComments', () => {
  it('appelle GET /forums/:id/comments avec la pagination par défaut', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 1, limit: 20, total: 0, totalPages: 1 } })

    await fetchForumComments(FORUM_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/comments`, {
      params: { page: 1, limit: 20 },
    })
  })

  it('transmet page/limit explicites', async () => {
    mockGet.mockResolvedValue({ data: { data: [], page: 2, limit: 50, total: 0, totalPages: 3 } })

    await fetchForumComments(FORUM_ID, { page: 2, limit: 50 })

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/comments`, {
      params: { page: 2, limit: 50 },
    })
  })
})

describe('createForumComment', () => {
  it('poste au chemin documenté', async () => {
    mockPost.mockResolvedValue({ data: { id: 'c1', forumId: FORUM_ID, content: 'x' } })

    await createForumComment(FORUM_ID, { content: 'Un commentaire' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/comments`, {
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

    await expect(createForumComment(FORUM_ID, { content: 'x' })).rejects.toMatchObject({
      response: { data: { code: 'CHARTER_NOT_ACCEPTED' } },
    })
  })
})

describe('deleteForumComment', () => {
  it('appelle DELETE /forums/:id/comments/:commentId', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteForumComment(FORUM_ID, 'comment-1')

    expect(mockDelete).toHaveBeenCalledWith(`/forums/${FORUM_ID}/comments/comment-1`)
  })
})

describe('charte de bonne conduite', () => {
  it('GET /forums/charter', async () => {
    mockGet.mockResolvedValue({ data: { content: 'Texte', updatedAt: '2026-09-04T00:00:00Z' } })

    await fetchForumCharter()

    expect(mockGet).toHaveBeenCalledWith('/forums/charter')
  })

  it('PATCH /forums/charter avec { content }', async () => {
    mockPatch.mockResolvedValue({ data: { content: 'Nouveau texte', updatedAt: '2026-09-04T00:00:00Z' } })

    await updateForumCharter('Nouveau texte')

    expect(mockPatch).toHaveBeenCalledWith('/forums/charter', { content: 'Nouveau texte' })
  })

  it('GET /forums/charter/acceptance', async () => {
    mockGet.mockResolvedValue({ data: { accepted: false, acceptedAt: null } })

    await fetchForumCharterAcceptance()

    expect(mockGet).toHaveBeenCalledWith('/forums/charter/acceptance')
  })

  it('POST /forums/charter/acceptance, idempotent', async () => {
    mockPost.mockResolvedValue({ data: { accepted: true, acceptedAt: '2026-09-04T00:00:00Z' } })

    const result = await acceptForumCharter()

    expect(mockPost).toHaveBeenCalledWith('/forums/charter/acceptance')
    expect(result.accepted).toBe(true)
  })
})

describe('image d’illustration', () => {
  it('GET /forums/image-constraints', async () => {
    mockGet.mockResolvedValue({ data: { maxSizeBytes: 1_000_000, allowedMimeTypes: ['image/jpeg'] } })

    await fetchForumImageConstraints()

    expect(mockGet).toHaveBeenCalledWith('/forums/image-constraints')
  })

  it('poste un multipart au chemin documenté, champ `file`, Content-Type neutralisé', async () => {
    mockPost.mockResolvedValue({ data: { id: FORUM_ID, imageFilename: 'x.webp' } })
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })

    await uploadForumImage(FORUM_ID, file)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe(`/forums/${FORUM_ID}/image`)
    expect(calledBody).toBeInstanceOf(FormData)
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()
  })

  it('lit les octets en blob (GET /forums/:id/image)', async () => {
    const imageBlob = new Blob(['octets'], { type: 'image/webp' })
    mockGet.mockResolvedValue({ data: imageBlob })

    const result = await fetchForumImageBlob(FORUM_ID)

    expect(mockGet).toHaveBeenCalledWith(`/forums/${FORUM_ID}/image`, { responseType: 'blob' })
    expect(result).toBe(imageBlob)
  })

  it('propage le 404 — trois causes volontairement indistinctes côté front', async () => {
    mockGet.mockRejectedValue({ response: { status: 404 } })

    await expect(fetchForumImageBlob(FORUM_ID)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})

describe('createForumExclusion', () => {
  it('poste au chemin documenté', async () => {
    mockPost.mockResolvedValue({ data: { id: 'excl-1', forumId: FORUM_ID } })

    await createForumExclusion(FORUM_ID, { excludedUserId: 'user-1', reason: 'motif' })

    expect(mockPost).toHaveBeenCalledWith(`/forums/${FORUM_ID}/exclusions`, {
      excludedUserId: 'user-1',
      reason: 'motif',
    })
  })
})
