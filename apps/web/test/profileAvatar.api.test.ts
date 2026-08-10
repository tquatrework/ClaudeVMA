/**
 * Tests du transport HTTP de la photo de profil (`src/api/profile.ts`).
 *
 * Ce qui est gardé ici, c'est le **contrat exact** de `docs/routes.md`
 * § « Photo de profil » (2026-08-10) : chemin réel côté serveur, nom du champ
 * multipart, lecture en octets et rejeu du jeton de version. Une URL inventée
 * d'après le nom d'un écran React, ou un champ nommé autrement que `file`, ne
 * produirait qu'un `400` en production.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '../src/api/client'
import {
  deleteProfileAvatar,
  fetchProfileAvatarBlob,
  uploadProfileAvatar,
} from '../src/api/profile'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockDelete = vi.mocked(apiClient.delete)

const USER_ID = '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355'

function makePhotoFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('uploadProfileAvatar', () => {
  it('poste un multipart au chemin documenté, champ `file`', async () => {
    mockPost.mockResolvedValue({
      data: { avatarUrl: `/api/v1/profiles/${USER_ID}/avatar?v=1754820000000` },
    })

    const result = await uploadProfileAvatar(USER_ID, makePhotoFile())

    expect(mockPost).toHaveBeenCalledTimes(1)
    const [calledUrl, calledBody] = mockPost.mock.calls[0]
    expect(calledUrl).toBe(`/profiles/${USER_ID}/avatar`)
    expect(calledBody).toBeInstanceOf(FormData)
    // Le serveur n'accepte qu'un seul fichier, sous ce nom exact.
    expect((calledBody as FormData).getAll('file')).toHaveLength(1)
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
