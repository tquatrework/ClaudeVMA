/**
 * Tests du module API archiveDocument.
 *
 * Le contrat vérifié ici est celui de la **pile réelle** (2026-08-11) :
 * enveloppe paginée `{data, page, limit, total, totalPages}`, timeline groupée par
 * date, `sourceId`/`sourceService` obligatoires à la création.
 *
 * L'ancien jeu de tests validait un repli `Array.isArray(data) ? data : []` qui
 * transformait une réponse valide du serveur en « aucune archive » : un test vert
 * sur un comportement faux. Ce repli a disparu — une enveloppe inattendue doit se
 * voir, pas se taire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  fetchPedagogicalArchives,
  fetchArchiveTimeline,
  downloadArchiveDocument,
  createArchiveLink,
  type CreateArchiveLinkPayload,
} from '../src/api/archiveDocument'
import {
  COURSE_SUMMARY_ITEM,
  STUDENT_ID,
  TIMELINE_GROUPS,
  paginate,
} from './fixtures/archives'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPedagogicalArchives', () => {
  it('appelle GET /archives/students/:userId/pedagogical-archives', async () => {
    mockGet.mockResolvedValue({ data: paginate([COURSE_SUMMARY_ITEM]) })

    const result = await fetchPedagogicalArchives(STUDENT_ID)

    expect(mockGet).toHaveBeenCalledWith(
      `/archives/students/${STUDENT_ID}/pedagogical-archives`,
    )
    expect(result.total).toBe(1)
    expect(result.data[0].id).toBe(COURSE_SUMMARY_ITEM.id)
  })

  it("expose l'enveloppe de pagination telle que le serveur la renvoie", async () => {
    mockGet.mockResolvedValue({ data: paginate([COURSE_SUMMARY_ITEM]) })

    const result = await fetchPedagogicalArchives(STUDENT_ID)

    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.totalPages).toBe(1)
  })

  it('propage une erreur 404 — absence et refus sont indiscernables, à traiter en amont', async () => {
    const notFoundError = { response: { status: 404 } }
    mockGet.mockRejectedValue(notFoundError)

    await expect(fetchPedagogicalArchives(STUDENT_ID)).rejects.toEqual(notFoundError)
  })

  it('propage une erreur 503 quand profile-service est injoignable', async () => {
    const unavailableError = { response: { status: 503 } }
    mockGet.mockRejectedValue(unavailableError)

    await expect(fetchPedagogicalArchives(STUDENT_ID)).rejects.toEqual(unavailableError)
  })
})

describe('fetchArchiveTimeline', () => {
  it('appelle GET /archives/students/:userId/archive-timeline', async () => {
    mockGet.mockResolvedValue({ data: paginate(TIMELINE_GROUPS) })

    const result = await fetchArchiveTimeline(STUDENT_ID)

    expect(mockGet).toHaveBeenCalledWith(`/archives/students/${STUDENT_ID}/archive-timeline`)
    expect(result.data).toHaveLength(3)
  })

  it('renvoie des groupes datés, pas des éléments à plat', async () => {
    mockGet.mockResolvedValue({ data: paginate(TIMELINE_GROUPS) })

    const result = await fetchArchiveTimeline(STUDENT_ID)

    expect(result.data[0].date).toBe('2026-03-03')
    expect(result.data[0].items[0].title).toBe('Résumé du cours du 3 mars')
  })

  it("propage l'erreur 404 à l'appelant", async () => {
    const notFoundError = { response: { status: 404 } }
    mockGet.mockRejectedValue(notFoundError)

    await expect(fetchArchiveTimeline(STUDENT_ID)).rejects.toEqual(notFoundError)
  })
})

describe('downloadArchiveDocument', () => {
  it('appelle GET /documents/:id/download avec responseType blob', async () => {
    const blobData = new Blob(['fake-content'], { type: 'application/pdf' })
    mockGet.mockResolvedValue({ data: blobData })

    const result = await downloadArchiveDocument('doc-99')

    expect(mockGet).toHaveBeenCalledWith('/documents/doc-99/download', {
      responseType: 'blob',
    })
    expect(result).toBeInstanceOf(Blob)
  })

  it("propage l'erreur 404 si le document est introuvable ou hors de portée", async () => {
    const notFoundError = { response: { status: 404 } }
    mockGet.mockRejectedValue(notFoundError)

    await expect(downloadArchiveDocument('doc-missing')).rejects.toEqual(notFoundError)
  })
})

describe('createArchiveLink', () => {
  const createPayload: CreateArchiveLinkPayload = {
    itemType: 'resume_de_cours',
    title: 'Résumé manuel',
    description: 'Lien manuel créé par le formateur.',
    sourceId: '7f0e6d38-1111-4a11-9111-000000000009',
    sourceService: 'video-session-service',
    occurredAt: '2026-04-01T10:00:00.000Z',
  }

  it('appelle POST /archives/students/:userId/archive-links avec le bon payload', async () => {
    mockPost.mockResolvedValue({ data: { ...COURSE_SUMMARY_ITEM, id: 'new-1' } })

    const result = await createArchiveLink(STUDENT_ID, createPayload)

    expect(mockPost).toHaveBeenCalledWith(
      `/archives/students/${STUDENT_ID}/archive-links`,
      createPayload,
    )
    expect(result.id).toBe('new-1')
  })

  it("propage l'erreur 403 : une relation ouvre la lecture, jamais l'écriture", async () => {
    const forbiddenError = { response: { status: 403 } }
    mockPost.mockRejectedValue(forbiddenError)

    await expect(createArchiveLink(STUDENT_ID, createPayload)).rejects.toEqual(forbiddenError)
  })

  it("propage l'erreur 400 quand sourceId ou sourceService manque", async () => {
    const badRequestError = { response: { status: 400 } }
    mockPost.mockRejectedValue(badRequestError)

    await expect(createArchiveLink(STUDENT_ID, createPayload)).rejects.toEqual(badRequestError)
  })
})
