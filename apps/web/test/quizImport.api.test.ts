/**
 * Tests du transport HTTP de l'import de Quizz (`src/api/quizImport.ts`).
 *
 * Verrouille le contrat exact posé par `docs/architecture.md` > « Import de
 * Quizz depuis un tableur » : chemins réels, nom du champ multipart, forme
 * de la réponse par bloc. À rejouer contre la pile réelle une fois
 * `content-catalog-service` livré (`POST /quizzes/import`,
 * `GET /quizzes/import/constraints`).
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
import { fetchQuizImportConstraints, importQuizzes } from '../src/api/quizImport'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchQuizImportConstraints', () => {
  it('appelle GET /quizzes/import/constraints', async () => {
    mockGet.mockResolvedValue({ data: { maxFileSizeBytes: 900_000 } })

    const constraints = await fetchQuizImportConstraints()

    expect(mockGet).toHaveBeenCalledWith('/quizzes/import/constraints')
    expect(constraints.maxFileSizeBytes).toBe(900_000)
  })
})

describe('importQuizzes', () => {
  it('poste un multipart au chemin documenté, champ `file`, Content-Type neutralisé', async () => {
    mockPost.mockResolvedValue({
      data: [
        { blockIndex: 0, status: 'created', quizId: 'quiz-1', validationStatus: 'pending_validation' },
        { blockIndex: 1, status: 'error', errors: [{ row: 12, message: 'catégorie inconnue' }] },
      ],
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'quizzes.csv', { type: 'text/csv' })
    const results = await importQuizzes(file)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe('/quizzes/import')
    expect(calledBody).toBeInstanceOf(FormData)
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ status: 'created', quizId: 'quiz-1' })
    expect(results[1]).toMatchObject({ status: 'error' })
    expect(results[1].errors?.[0]).toMatchObject({ row: 12 })
  })

  it("propage un 413 structuré, sans le transformer en succès", async () => {
    mockPost.mockRejectedValue({
      response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 900_000 } },
    })

    const file = new File([new Uint8Array([1])], 'gros.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await expect(importQuizzes(file)).rejects.toMatchObject({ response: { status: 413 } })
  })

  it('propage un 403 (créateur non autorisé)', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })

    const file = new File([new Uint8Array([1])], 'quizzes.csv', { type: 'text/csv' })
    await expect(importQuizzes(file)).rejects.toMatchObject({ response: { status: 403 } })
  })
})
