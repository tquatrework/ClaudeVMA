/**
 * Tests pour le module API archiveDocument (Phase 11)
 *
 * Couvre :
 * - fetchPedagogicalArchives appelle le bon endpoint avec le bon studentId
 * - fetchArchiveTimeline appelle le bon endpoint avec le bon studentId
 * - downloadArchiveDocument appelle le bon endpoint avec responseType: 'blob'
 * - createArchiveLink appelle POST avec le bon payload
 * - Cas nominal : retour tableau vide si la réponse n'est pas un tableau
 * - Typage correct des erreurs HTTP (403, 404 propagés à l'appelant)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock du client API ───────────────────────────────────────────────────────

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
  type PedagogicalArchiveItem,
  type ArchiveTimelineEntry,
  type CreateArchiveLinkPayload,
} from '../src/api/archiveDocument'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ARCHIVE_ITEM: PedagogicalArchiveItem = {
  id: 'archive-1',
  studentId: 'student-42',
  itemType: 'course_summary',
  title: 'Résumé — Algèbre',
  description: 'Intro aux matrices.',
  sourceUrl: 'https://example.com/session/1',
  downloadUrl: undefined,
  occurredAt: '2026-03-10T14:00:00.000Z',
  createdAt: '2026-03-10T15:00:00.000Z',
  isAccessibleToFinanceOwner: true,
}

const TIMELINE_ENTRY: ArchiveTimelineEntry = {
  id: 'entry-1',
  studentId: 'student-42',
  itemType: 'course_summary',
  title: 'Résumé — Algèbre',
  occurredAt: '2026-03-10T14:00:00.000Z',
  sourceUrl: 'https://example.com/session/1',
  isAccessibleToFinanceOwner: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── fetchPedagogicalArchives ─────────────────────────────────────────────────

describe('fetchPedagogicalArchives', () => {
  it('appelle GET /students/:studentId/pedagogical-archives avec le bon id', async () => {
    mockGet.mockResolvedValue({ data: [ARCHIVE_ITEM] })

    const result = await fetchPedagogicalArchives('student-42')

    expect(mockGet).toHaveBeenCalledWith('/students/student-42/pedagogical-archives')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('archive-1')
  })

  it('retourne un tableau vide si la réponse data n\'est pas un tableau', async () => {
    mockGet.mockResolvedValue({ data: null })

    const result = await fetchPedagogicalArchives('student-42')

    expect(result).toEqual([])
  })

  it('propage l\'erreur 403 à l\'appelant', async () => {
    const error403 = { response: { status: 403 } }
    mockGet.mockRejectedValue(error403)

    await expect(fetchPedagogicalArchives('student-42')).rejects.toEqual(error403)
  })

  it('propage l\'erreur 404 à l\'appelant', async () => {
    const error404 = { response: { status: 404 } }
    mockGet.mockRejectedValue(error404)

    await expect(fetchPedagogicalArchives('student-42')).rejects.toEqual(error404)
  })
})

// ─── fetchArchiveTimeline ─────────────────────────────────────────────────────

describe('fetchArchiveTimeline', () => {
  it('appelle GET /students/:studentId/archive-timeline avec le bon id', async () => {
    mockGet.mockResolvedValue({ data: [TIMELINE_ENTRY] })

    const result = await fetchArchiveTimeline('student-42')

    expect(mockGet).toHaveBeenCalledWith('/students/student-42/archive-timeline')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('entry-1')
  })

  it('retourne un tableau vide si la réponse data n\'est pas un tableau', async () => {
    mockGet.mockResolvedValue({ data: undefined })

    const result = await fetchArchiveTimeline('student-42')

    expect(result).toEqual([])
  })

  it('propage l\'erreur 403 à l\'appelant', async () => {
    const error403 = { response: { status: 403 } }
    mockGet.mockRejectedValue(error403)

    await expect(fetchArchiveTimeline('student-42')).rejects.toEqual(error403)
  })

  it('propage l\'erreur 404 à l\'appelant', async () => {
    const error404 = { response: { status: 404 } }
    mockGet.mockRejectedValue(error404)

    await expect(fetchArchiveTimeline('student-42')).rejects.toEqual(error404)
  })
})

// ─── downloadArchiveDocument ──────────────────────────────────────────────────

describe('downloadArchiveDocument', () => {
  it('appelle GET /archive-documents/:id/download avec responseType blob', async () => {
    const blobData = new Blob(['fake-content'], { type: 'application/pdf' })
    mockGet.mockResolvedValue({ data: blobData })

    const result = await downloadArchiveDocument('doc-99')

    expect(mockGet).toHaveBeenCalledWith('/archive-documents/doc-99/download', {
      responseType: 'blob',
    })
    expect(result).toBeInstanceOf(Blob)
  })

  it('propage l\'erreur 403 si le document est restreint', async () => {
    const error403 = { response: { status: 403 } }
    mockGet.mockRejectedValue(error403)

    await expect(downloadArchiveDocument('doc-restricted')).rejects.toEqual(error403)
  })

  it('propage l\'erreur 404 si le document n\'existe pas', async () => {
    const error404 = { response: { status: 404 } }
    mockGet.mockRejectedValue(error404)

    await expect(downloadArchiveDocument('doc-missing')).rejects.toEqual(error404)
  })
})

// ─── createArchiveLink ────────────────────────────────────────────────────────

describe('createArchiveLink', () => {
  const createPayload: CreateArchiveLinkPayload = {
    itemType: 'course_summary',
    title: 'Résumé manuel',
    description: 'Lien manuel créé par le formateur.',
    sourceUrl: 'https://example.com/external/1',
    occurredAt: '2026-04-01T10:00:00.000Z',
  }

  it('appelle POST /students/:studentId/archive-links avec le bon payload', async () => {
    mockPost.mockResolvedValue({ data: { ...ARCHIVE_ITEM, ...createPayload, id: 'new-1' } })

    const result = await createArchiveLink('student-42', createPayload)

    expect(mockPost).toHaveBeenCalledWith(
      '/students/student-42/archive-links',
      createPayload,
    )
    expect(result.id).toBe('new-1')
  })

  it('propage l\'erreur 403 si le rôle n\'est pas autorisé', async () => {
    const error403 = { response: { status: 403 } }
    mockPost.mockRejectedValue(error403)

    await expect(createArchiveLink('student-42', createPayload)).rejects.toEqual(error403)
  })

  it('propage l\'erreur 400 si le payload est invalide', async () => {
    const error400 = { response: { status: 400 } }
    mockPost.mockRejectedValue(error400)

    await expect(createArchiveLink('student-42', createPayload)).rejects.toEqual(error400)
  })
})
