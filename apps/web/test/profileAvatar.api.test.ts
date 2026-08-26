/**
 * Tests du transport HTTP de la photo de profil (`src/api/profile.ts`).
 *
 * Ce qui est gardé ici, c'est le **contrat exact** de `docs/routes.md`
 * § « Photo de profil » (2026-08-10) : chemin réel côté serveur, nom du champ
 * multipart, lecture en octets et rejeu du jeton de version. Une URL inventée
 * d'après le nom d'un écran React, ou un champ nommé autrement que `file`, ne
 * produirait qu'un `400` en production.
 *
 * **Portée volontairement limitée** : `apiClient` est simulé ici, donc ce
 * fichier ne dit rien de ce qui part réellement sur le réseau. Il est resté vert
 * pendant que tout envoi échouait en `400 « Aucun fichier reçu. »`, le
 * `Content-Type` JSON par défaut faisant convertir le `FormData` en JSON par
 * axios. Les en-têtes et le corps réellement émis sont couverts par
 * `test/apiClient.formData.test.ts`, qui descend jusqu'à `XMLHttpRequest`.
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
  deleteProfileAvatar,
  fetchProfileAvatarBlob,
  fetchProfileAvatarConstraints,
  updateProfileAvatarSettings,
  uploadProfileAvatar,
} from '../src/api/profile'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPatch = vi.mocked(apiClient.patch)
const mockDelete = vi.mocked(apiClient.delete)

const USER_ID = '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355'

function makePhotoFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchProfileAvatarConstraints', () => {
  it('appelle le chemin documenté, sans :userId', async () => {
    // Les contraintes ne dépendent ni du profil visé ni du lecteur : une URL
    // calquée sur `/profiles/:userId/...` n'existe pas côté serveur.
    mockGet.mockResolvedValue({
      data: {
        maxUploadBytes: 1_000_000,
        acceptedContentTypes: ['image/jpeg'],
        outputContentType: 'image/webp',
        maxDimensionPixels: 512,
      },
    })

    const constraints = await fetchProfileAvatarConstraints()

    expect(mockGet).toHaveBeenCalledWith('/profiles/avatar/constraints')
    expect(constraints.maxUploadBytes).toBe(1_000_000)
  })
})

describe('uploadProfileAvatar', () => {
  it('poste un multipart au chemin documenté, champ `file`', async () => {
    mockPost.mockResolvedValue({
      data: { avatarUrl: `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000` },
    })

    const result = await uploadProfileAvatar(USER_ID, makePhotoFile())

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody, calledConfig] = mockPost.mock.calls[0]
    expect(calledUrl).toBe(`/profiles/${USER_ID}/avatar`)
    expect(calledBody).toBeInstanceOf(FormData)
    // Le serveur n'accepte qu'un seul fichier, sous ce nom exact.
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
    // L'en-tête est neutralisé pour que le navigateur pose lui-même
    // `multipart/form-data; boundary=…`. Surtout pas `multipart/form-data` en
    // dur : sans boundary, le corps est illisible côté serveur.
    const sentContentType = (calledConfig as { headers?: Record<string, unknown> } | undefined)
      ?.headers?.['Content-Type']
    expect(sentContentType).toBeUndefined()
    expect(result.avatarUrl).toContain('?v=1754820000000')
  })

  it('propage un refus du serveur au lieu de le transformer en succès', async () => {
    mockPost.mockRejectedValue({ response: { status: 413 } })

    await expect(uploadProfileAvatar(USER_ID, makePhotoFile())).rejects.toMatchObject({
      response: { status: 413 },
    })
  })
})

describe('fetchProfileAvatarBlob', () => {
  it('lit les octets et rejoue le jeton de version', async () => {
    const photoBlob = new Blob(['octets'], { type: 'image/webp' })
    mockGet.mockResolvedValue({ data: photoBlob })

    const result = await fetchProfileAvatarBlob(USER_ID, '1754820000000')

    expect(mockGet).toHaveBeenCalledWith(`/profiles/${USER_ID}/avatar`, {
      responseType: 'blob',
      params: { v: '1754820000000' },
    })
    expect(result).toBe(photoBlob)
  })

  it("n'ajoute aucun paramètre quand aucun jeton n'est connu", async () => {
    mockGet.mockResolvedValue({ data: new Blob([]) })

    await fetchProfileAvatarBlob(USER_ID)

    expect(mockGet).toHaveBeenCalledWith(`/profiles/${USER_ID}/avatar`, {
      responseType: 'blob',
      params: undefined,
    })
  })

  it('propage le 404, que l’appelant traite comme une absence', async () => {
    // « Pas de photo » et « photo masquée » sont volontairement indiscernables :
    // la couche transport ne tranche pas, elle laisse remonter le statut.
    mockGet.mockRejectedValue({ response: { status: 404 } })

    await expect(fetchProfileAvatarBlob(USER_ID)).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})

describe('deleteProfileAvatar', () => {
  it('appelle le chemin documenté', async () => {
    mockDelete.mockResolvedValue({ status: 204 })

    await deleteProfileAvatar(USER_ID)

    expect(mockDelete).toHaveBeenCalledWith(`/profiles/${USER_ID}/avatar`)
  })

  it('propage un refus de droit', async () => {
    mockDelete.mockRejectedValue({ response: { status: 403 } })

    await expect(deleteProfileAvatar(USER_ID)).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})

describe('updateProfileAvatarSettings', () => {
  it('appelle PATCH /profiles/avatar/settings, pas /admin', async () => {
    mockPatch.mockResolvedValue({
      data: { maxAvatarUploadBytes: 2_000_000, updatedAt: '2026-08-26T00:00:00.000Z' },
    })

    const result = await updateProfileAvatarSettings({ maxAvatarUploadBytes: 2_000_000 })

    expect(mockPatch).toHaveBeenCalledWith('/profiles/avatar/settings', {
      maxAvatarUploadBytes: 2_000_000,
    })
    // La réponse est la valeur RELUE en base, jamais le corps envoyé tel quel.
    expect(result.maxAvatarUploadBytes).toBe(2_000_000)
    expect(result.updatedAt).toBe('2026-08-26T00:00:00.000Z')
  })

  it('propage un 403 (réservé au TI)', async () => {
    mockPatch.mockRejectedValue({ response: { status: 403 } })

    await expect(updateProfileAvatarSettings({ maxAvatarUploadBytes: 2_000_000 })).rejects.toMatchObject({
      response: { status: 403 },
    })
  })
})
