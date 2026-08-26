/**
 * Tests du transport HTTP des pièces jointes du cahier de texte
 * (`src/api/pedagogicalLogAttachments.ts`).
 *
 * Verrouille le contrat exact de `docs/routes.md` § « Liens et pièces
 * jointes » (2026-08-26) : chemins réels, nom du champ multipart, réglages
 * système sous `/pedagogical-logs/settings/attachments`.
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
  deleteLogAttachment,
  fetchAttachmentSettings,
  fetchLogAttachmentBlob,
  fetchLogAttachments,
  updateAttachmentSettings,
  uploadLogAttachment,
} from '../src/api/pedagogicalLogAttachments'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)
const mockDelete = vi.mocked(apiClient.delete)

const LOG_ID = 'log-1'
const ATTACHMENT_ID = 'attachment-1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchAttachmentSettings', () => {
  it('appelle GET /pedagogical-logs/settings/attachments', async () => {
    mockGet.mockResolvedValue({
      data: { id: 's1', attachmentsEnabled: true, maxFileBytes: 100_000, maxTotalBytesPerEntry: 5_000_000, updatedAt: '2026-08-26T00:00:00.000Z' },
    })

    const settings = await fetchAttachmentSettings()

    expect(mockGet).toHaveBeenCalledWith('/pedagogical-logs/settings/attachments')
    expect(settings.attachmentsEnabled).toBe(true)
  })
})

describe('updateAttachmentSettings', () => {
  it('appelle PATCH avec seulement les champs fournis', async () => {
    mockPatch.mockResolvedValue({
      data: { id: 's1', attachmentsEnabled: false, maxFileBytes: 100_000, maxTotalBytesPerEntry: 5_000_000, updatedAt: '2026-08-26T00:01:00.000Z' },
    })

    const result = await updateAttachmentSettings({ attachmentsEnabled: false })

    expect(mockPatch).toHaveBeenCalledWith('/pedagogical-logs/settings/attachments', {
      attachmentsEnabled: false,
    })
    expect(result.attachmentsEnabled).toBe(false)
  })

  it('propage un refus 403 (réservé au TI)', async () => {
    mockPatch.mockRejectedValue({ response: { status: 403 } })

    await expect(updateAttachmentSettings({ maxFileBytes: 1000 })).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})

describe('fetchLogAttachments', () => {
  it('appelle GET /logs/:id/attachments', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await fetchLogAttachments(LOG_ID)

    expect(mockGet).toHaveBeenCalledWith(`/logs/${LOG_ID}/attachments`)
  })
})

describe('uploadLogAttachment', () => {
  it('poste un multipart au chemin documenté, champ `file`, Content-Type neutralisé', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: ATTACHMENT_ID,
        logEntryId: LOG_ID,
        originalFilename: 'fiche.pdf',
        storedFilename: 'abc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        uploadedBy: 'teacher-1',
        createdAt: '2026-08-26T00:00:00.000Z',
      },
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'fiche.pdf', { type: 'application/pdf' })
    const result = await uploadLogAttachment(LOG_ID, file)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe(`/logs/${LOG_ID}/attachments`)
    expect(calledBody).toBeInstanceOf(FormData)
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()
    expect(result.originalFilename).toBe('fiche.pdf')
  })

  it('propage un 413 structuré, sans le transformer en succès', async () => {
    mockPost.mockRejectedValue({
      response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 100_000 } },
    })

    const file = new File([new Uint8Array([1])], 'gros.pdf', { type: 'application/pdf' })
    await expect(uploadLogAttachment(LOG_ID, file)).rejects.toMatchObject({
      response: { status: 413 },
    })
  })
})

describe('fetchLogAttachmentBlob', () => {
  it('lit les octets en blob au chemin documenté', async () => {
    const blob = new Blob(['octets'])
    mockGet.mockResolvedValue({ data: blob })

    const result = await fetchLogAttachmentBlob(LOG_ID, ATTACHMENT_ID)

    expect(mockGet).toHaveBeenCalledWith(`/logs/${LOG_ID}/attachments/${ATTACHMENT_ID}`, {
      responseType: 'blob',
    })
    expect(result).toBe(blob)
  })
})

describe('deleteLogAttachment', () => {
  it('appelle DELETE au chemin documenté', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteLogAttachment(LOG_ID, ATTACHMENT_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/logs/${LOG_ID}/attachments/${ATTACHMENT_ID}`)
  })
})
