/**
 * Tests du transport HTTP du mémo élève (`src/api/pedagogicalLogMemos.ts`).
 *
 * Verrouille le contrat réel de `docs/routes.md` § « Mémo élève — assaini le
 * 2026-08-27 » : chemins réels, distincts de l'ancien contrat
 * (`POST/GET/PUT/DELETE /memos/:id`) qui n'a jamais existé côté serveur.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  createMemoChapter,
  createMemoTextOrFormulaItem,
  deleteMemoChapter,
  deleteMemoItem,
  fetchMemoChapterDetail,
  fetchMemoItemImageBlob,
  fetchMyMemo,
  fetchStudentMemo,
  searchMemoItems,
  updateMemoChapter,
  updateMemoItem,
  uploadMemoImageItem,
} from '../src/api/pedagogicalLogMemos'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockDelete = vi.mocked(apiClient.delete)

const CHAPTER_ID = 'chapter-1'
const ITEM_ID = 'item-1'
const STUDENT_ID = 'student-42'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchMyMemo', () => {
  it('appelle GET /memos', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await fetchMyMemo()

    expect(mockGet).toHaveBeenCalledWith('/memos')
  })
})

describe('searchMemoItems', () => {
  it('appelle GET /memos/search avec le paramètre q', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await searchMemoItems('cosinus')

    expect(mockGet).toHaveBeenCalledWith('/memos/search', { params: { q: 'cosinus' } })
  })
})

describe('fetchStudentMemo', () => {
  it('appelle GET /memos/students/:studentId — route consolidée pour titulaire ou tiers relié', async () => {
    mockGet.mockResolvedValue({ data: [] })

    await fetchStudentMemo(STUDENT_ID)

    expect(mockGet).toHaveBeenCalledWith(`/memos/students/${STUDENT_ID}`)
  })
})

describe('fetchMemoChapterDetail', () => {
  it('appelle GET /memos/chapters/:chapterId', async () => {
    mockGet.mockResolvedValue({ data: { id: CHAPTER_ID, items: [] } })

    await fetchMemoChapterDetail(CHAPTER_ID)

    expect(mockGet).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}`)
  })
})

describe('createMemoChapter', () => {
  it('appelle POST /memos/chapters avec le titre', async () => {
    mockPost.mockResolvedValue({ data: { id: CHAPTER_ID, title: 'Algèbre' } })

    await createMemoChapter({ title: 'Algèbre' })

    expect(mockPost).toHaveBeenCalledWith('/memos/chapters', { title: 'Algèbre' })
  })

  it('propage un 400 (plafond de chapitres atteint) sans le transformer en succès', async () => {
    mockPost.mockRejectedValue({ response: { status: 400 } })

    await expect(createMemoChapter({ title: 'Trop' })).rejects.toMatchObject({
      response: { status: 400 },
    })
  })
})

describe('updateMemoChapter', () => {
  it('appelle PUT /memos/chapters/:chapterId avec la mise à jour partielle', async () => {
    mockPut.mockResolvedValue({ data: { id: CHAPTER_ID, title: 'Renommé' } })

    await updateMemoChapter(CHAPTER_ID, { title: 'Renommé' })

    expect(mockPut).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}`, { title: 'Renommé' })
  })
})

describe('deleteMemoChapter', () => {
  it('appelle DELETE /memos/chapters/:chapterId', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteMemoChapter(CHAPTER_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}`)
  })
})

describe('createMemoTextOrFormulaItem', () => {
  it('appelle POST /memos/chapters/:chapterId/items avec type texte', async () => {
    mockPost.mockResolvedValue({ data: { id: ITEM_ID, type: 'text', content: 'Une note' } })

    await createMemoTextOrFormulaItem(CHAPTER_ID, { type: 'text', content: 'Une note' })

    expect(mockPost).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}/items`, {
      type: 'text',
      content: 'Une note',
    })
  })

  it('appelle POST /memos/chapters/:chapterId/items avec type formule', async () => {
    mockPost.mockResolvedValue({ data: { id: ITEM_ID, type: 'formula', content: 'x^2' } })

    await createMemoTextOrFormulaItem(CHAPTER_ID, { type: 'formula', content: 'x^2' })

    expect(mockPost).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}/items`, {
      type: 'formula',
      content: 'x^2',
    })
  })
})

describe('updateMemoItem', () => {
  it('appelle PUT /memos/chapters/:chapterId/items/:itemId', async () => {
    mockPut.mockResolvedValue({ data: { id: ITEM_ID, content: 'Modifié' } })

    await updateMemoItem(CHAPTER_ID, ITEM_ID, { content: 'Modifié' })

    expect(mockPut).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}/items/${ITEM_ID}`, {
      content: 'Modifié',
    })
  })
})

describe('deleteMemoItem', () => {
  it('appelle DELETE /memos/chapters/:chapterId/items/:itemId', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteMemoItem(CHAPTER_ID, ITEM_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}/items/${ITEM_ID}`)
  })
})

describe('uploadMemoImageItem', () => {
  it('poste un multipart au chemin documenté, champ `file`, Content-Type neutralisé', async () => {
    mockPost.mockResolvedValue({
      data: { id: ITEM_ID, type: 'image', imageOriginalFilename: 'schema.png' },
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'schema.png', { type: 'image/png' })
    const result = await uploadMemoImageItem(CHAPTER_ID, file, 'Légende', 2)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe(`/memos/chapters/${CHAPTER_ID}/items/image`)
    expect(calledBody).toBeInstanceOf(FormData)
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    expect((calledBody as FormData).get('caption')).toBe('Légende')
    expect((calledBody as FormData).get('order')).toBe('2')
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()
    expect(result.imageOriginalFilename).toBe('schema.png')
  })

  it('propage un 413 structuré sans le transformer en succès', async () => {
    mockPost.mockRejectedValue({
      response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 500_000 } },
    })

    const file = new File([new Uint8Array([1])], 'gros.png', { type: 'image/png' })
    await expect(uploadMemoImageItem(CHAPTER_ID, file)).rejects.toMatchObject({
      response: { status: 413 },
    })
  })
})

describe('fetchMemoItemImageBlob', () => {
  it('lit les octets en blob au chemin documenté', async () => {
    const blob = new Blob(['octets'])
    mockGet.mockResolvedValue({ data: blob })

    const result = await fetchMemoItemImageBlob(CHAPTER_ID, ITEM_ID)

    expect(mockGet).toHaveBeenCalledWith(`/memos/chapters/${CHAPTER_ID}/items/${ITEM_ID}/image`, {
      responseType: 'blob',
    })
    expect(result).toBe(blob)
  })
})
