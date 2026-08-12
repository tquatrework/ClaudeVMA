/**
 * Tests du module API — file de validation des nouveaux formateurs
 * (`GET /profiles/teachers/pending-validation` et
 * `PATCH /profiles/:teacherId/validation`, profile-service).
 *
 * Contrat vérifié contre la pile réelle le 2026-08-12
 * (https://claudevma.visioprof.fr, compte `trsflow.rp.0811`) :
 * - la file est une **enveloppe** `{data, page, limit, total, totalPages}`,
 *   plus un tableau nu ; l'identifiant est `userId`, la date `pendingSince` ;
 * - `PATCH` attend `{status, comment?}` — `{validationStatus}` est refusé en
 *   `400` (« property validationStatus should not exist ») ;
 * - `403` pour tout rôle autre que RP sur la file, et pour une transition
 *   interdite au rôle appelant.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  PENDING_TEACHERS_MAX_LIMIT,
  PENDING_TEACHERS_PAGE_SIZE,
  fetchPendingTeachers,
  fetchTeacherValidationStatus,
  updateTeacherValidationStatus,
} from '../src/api/profile'

const mockGet = vi.mocked(apiClient.get)
const mockPatch = vi.mocked(apiClient.patch)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPendingTeachers', () => {
  it('appelle le chemin backend documenté avec page et limit', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], page: 1, limit: 20, total: 0, totalPages: 0 },
    })

    await fetchPendingTeachers()

    expect(mockGet).toHaveBeenCalledWith('/profiles/teachers/pending-validation', {
      params: { page: 1, limit: PENDING_TEACHERS_PAGE_SIZE },
    })
  })

  it('ne demande jamais plus que le plafond déclaré par le serveur', () => {
    expect(PENDING_TEACHERS_MAX_LIMIT).toBe(100)
    expect(PENDING_TEACHERS_PAGE_SIZE).toBeLessThanOrEqual(PENDING_TEACHERS_MAX_LIMIT)
  })

  it("renvoie l'enveloppe telle quelle, sans la confondre avec un tableau", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            userId: '38132407-b428-4b11-a07c-4a719fcaa3c0',
            firstName: 'prof',
            lastName: 'lycee',
            levels: null,
            subjects: null,
            pendingSince: '2026-08-12T15:20:17.694Z',
          },
        ],
        page: 1,
        limit: 20,
        total: 17,
        totalPages: 1,
      },
    })

    const page = await fetchPendingTeachers()

    expect(page.total).toBe(17)
    expect(page.data).toHaveLength(1)
    expect(page.data[0].userId).toBe('38132407-b428-4b11-a07c-4a719fcaa3c0')
    expect(page.data[0].pendingSince).toBe('2026-08-12T15:20:17.694Z')
  })

  it('demande la page voulue quand on pagine', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], page: 2, limit: 20, total: 17, totalPages: 1 },
    })

    await fetchPendingTeachers(2)

    expect(mockGet).toHaveBeenCalledWith('/profiles/teachers/pending-validation', {
      params: { page: 2, limit: PENDING_TEACHERS_PAGE_SIZE },
    })
  })

  it('remonte le 403 opposé à tout rôle autre que RP', async () => {
    mockGet.mockRejectedValue({ response: { status: 403 } })

    await expect(fetchPendingTeachers()).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})

describe('fetchTeacherValidationStatus', () => {
  it('lit le statut sur le chemin documenté', async () => {
    mockGet.mockResolvedValue({ data: { teacherId: 'teacher-1', status: 'pending' } })

    const record = await fetchTeacherValidationStatus('teacher-1')

    expect(mockGet).toHaveBeenCalledWith('/profiles/teacher-1/validation')
    expect(record.status).toBe('pending')
  })
})

describe('updateTeacherValidationStatus', () => {
  it('envoie {status} — le nom du serveur, jamais validationStatus', async () => {
    mockPatch.mockResolvedValue({ data: { teacherId: 'teacher-1', status: 'in_review' } })

    await updateTeacherValidationStatus('teacher-1', { status: 'in_review' })

    expect(mockPatch).toHaveBeenCalledWith('/profiles/teacher-1/validation', {
      status: 'in_review',
    })
  })

  it('envoie le commentaire sous le nom {comment}', async () => {
    mockPatch.mockResolvedValue({ data: { teacherId: 'teacher-1', status: 'rejected' } })

    await updateTeacherValidationStatus('teacher-1', {
      status: 'rejected',
      comment: 'Dossier incomplet',
    })

    expect(mockPatch).toHaveBeenCalledWith('/profiles/teacher-1/validation', {
      status: 'rejected',
      comment: 'Dossier incomplet',
    })
  })

  it('remonte le 403 des transitions interdites au rôle appelant', async () => {
    mockPatch.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Seul le technicien informatique peut sauter l’étape…' },
      },
    })

    await expect(
      updateTeacherValidationStatus('teacher-1', { status: 'validated' }),
    ).rejects.toMatchObject({ response: { status: 403 } })
  })
})
