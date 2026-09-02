/**
 * Tests du transport HTTP de l'import d'Exercices (`src/api/exerciseImport.ts`).
 *
 * Verrouille le contrat exact posé par `docs/architecture.md` > « Import
 * d'Exercice depuis un tableur (CSV/Excel), et modèle de type identique pour
 * l'import de Quizz » et `docs/routes.md` > content-catalog-service > « Import
 * d'exercices depuis un fichier tableur » : chemins réels, nom du champ
 * multipart, forme de la réponse par bloc, fichier modèle téléchargeable.
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
  fetchExerciseImportConstraints,
  fetchExerciseImportTemplate,
  importExercises,
} from '../src/api/exerciseImport'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchExerciseImportConstraints', () => {
  it('appelle GET /exercises/import/constraints', async () => {
    mockGet.mockResolvedValue({ data: { maxFileSizeBytes: 900_000 } })

    const constraints = await fetchExerciseImportConstraints()

    expect(mockGet).toHaveBeenCalledWith('/exercises/import/constraints')
    expect(constraints.maxFileSizeBytes).toBe(900_000)
  })
})

describe('fetchExerciseImportTemplate', () => {
  it('appelle GET /exercises/import/template en blob', async () => {
    const blob = new Blob(['type,titre'], { type: 'text/csv' })
    mockGet.mockResolvedValue({ data: blob })

    const result = await fetchExerciseImportTemplate()

    expect(mockGet).toHaveBeenCalledWith('/exercises/import/template', {
      responseType: 'blob',
    })
    expect(result).toBe(blob)
  })
})

describe('importExercises', () => {
  it('poste un multipart au chemin documenté, champ `file`, Content-Type neutralisé', async () => {
    mockPost.mockResolvedValue({
      data: [
        {
          blockIndex: 0,
          status: 'created',
          exerciseId: 'exercise-1',
          validationStatus: 'pending_validation',
        },
        { blockIndex: 1, status: 'error', errors: [{ row: 8, message: 'question sans solution' }] },
      ],
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'exercises.csv', { type: 'text/csv' })
    const results = await importExercises(file)

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe('/exercises/import')
    expect(calledBody).toBeInstanceOf(FormData)
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ status: 'created', exerciseId: 'exercise-1' })
    expect(results[1]).toMatchObject({ status: 'error' })
    expect(results[1].errors?.[0]).toMatchObject({ row: 8 })
  })

  it('propage un 413 structuré, sans le transformer en succès', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 413,
        data: { code: 'EXERCISE_IMPORT_FILE_TOO_LARGE', maxUploadBytes: 900_000 },
      },
    })

    const file = new File([new Uint8Array([1])], 'gros.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await expect(importExercises(file)).rejects.toMatchObject({ response: { status: 413 } })
  })

  it('propage un 403 (créateur non autorisé)', async () => {
    mockPost.mockRejectedValue({ response: { status: 403 } })

    const file = new File([new Uint8Array([1])], 'exercises.csv', { type: 'text/csv' })
    await expect(importExercises(file)).rejects.toMatchObject({ response: { status: 403 } })
  })
})
