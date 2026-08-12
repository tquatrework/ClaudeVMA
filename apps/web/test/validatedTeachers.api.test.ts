/**
 * Tests du module API — annuaire des formateurs validés
 * (`GET /profiles/teachers/validated`, profile-service, 2026-08-12).
 *
 * Contrat vérifié contre la pile réelle (https://claudevma.visioprof.fr, compte
 * `trsflow.rp.0811`) : enveloppe `{data, page, limit, total, totalPages}`, plafond
 * `limit` à 100 refusé explicitement au-delà, `403` pour tout rôle non
 * administrateur.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  fetchValidatedTeachers,
  VALIDATED_TEACHERS_MAX_LIMIT,
} from '../src/api/profile'

const mockGet = vi.mocked(apiClient.get)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchValidatedTeachers', () => {
  it('appelle le chemin backend documenté avec page et limit', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], page: 1, limit: 100, total: 0, totalPages: 0 },
    })

    await fetchValidatedTeachers()

    expect(mockGet).toHaveBeenCalledWith('/profiles/teachers/validated', {
      params: { page: 1, limit: 100 },
    })
  })

  it("ne demande jamais plus que le plafond déclaré par le serveur", () => {
    expect(VALIDATED_TEACHERS_MAX_LIMIT).toBe(100)
  })

  it("renvoie l'enveloppe telle quelle, sans la confondre avec un tableau", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [
          {
            userId: 'teacher-nadia',
            firstName: 'Nadia',
            lastName: 'Lambert',
            levels: null,
            subjects: null,
          },
        ],
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 1,
      },
    })

    const page = await fetchValidatedTeachers()

    expect(page.total).toBe(2)
    expect(page.data).toHaveLength(1)
    expect(page.data[0].firstName).toBe('Nadia')
  })

  it('demande la page voulue quand on pagine', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], page: 3, limit: 100, total: 250, totalPages: 3 },
    })

    await fetchValidatedTeachers(3)

    expect(mockGet).toHaveBeenCalledWith('/profiles/teachers/validated', {
      params: { page: 3, limit: 100 },
    })
  })

  it('remonte le 403 opposé aux rôles non administrateurs', async () => {
    mockGet.mockRejectedValue({ response: { status: 403 } })

    await expect(fetchValidatedTeachers()).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})
