/**
 * Test de non-régression : ce qui part **réellement sur le réseau** pour un
 * envoi de fichier (`src/api/client.ts` + `src/api/profile.ts`).
 *
 * Contexte (2026-08-10) : tout envoi de photo de profil échouait depuis le
 * navigateur en `400 « Aucun fichier reçu. »`, alors que la même route
 * répondait `200` en `curl`. Cause : `apiClient` posait
 * `Content-Type: application/json` comme en-tête par défaut de l'instance, et
 * `transformRequest` d'axios fait
 * `return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data` —
 * le `FormData` était **converti en JSON** avant l'émission, le fichier perdu.
 *
 * Le test qui existait alors se contentait de vérifier l'URL et le nom du champ
 * sur un `apiClient` entièrement simulé : il restait vert pendant que la panne
 * était totale. On descend donc ici au niveau du transport en remplaçant
 * `XMLHttpRequest`, pour observer les **en-têtes et le corps réellement émis**
 * après toute la chaîne axios (intercepteurs, `transformRequest`, adaptateur).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest'

import apiClient from '../src/api/client'
import { uploadProfileAvatar } from '../src/api/profile'

interface EmittedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

let emittedRequest: EmittedRequest | null = null

/**
 * Faux `XMLHttpRequest` : il n'émet rien, il enregistre. C'est le dernier point
 * d'observation avant le réseau, donc le seul endroit où l'on voit ce que le
 * navigateur enverrait vraiment.
 */
class RecordingXMLHttpRequest {
  status = 200
  statusText = 'OK'
  responseText = '{"avatarUrl":"/api/v1/profiles/u/avatar?v=1754820000000"}'
  response = this.responseText
  readyState = 4
  timeout = 0
  withCredentials = false
  responseType = ''
  upload: null = null
  onloadend: (() => void) | null = null
  onabort: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null

  private requestMethod = ''
  private requestUrl = ''
  private requestHeaders: Record<string, string> = {}

  open(method: string, url: string) {
    this.requestMethod = method
    this.requestUrl = url
  }

  setRequestHeader(headerName: string, headerValue: string) {
    this.requestHeaders[headerName.toLowerCase()] = headerValue
  }

  getAllResponseHeaders() {
    return 'content-type: application/json\r\n'
  }

  abort() {}

  send(body: unknown) {
    emittedRequest = {
      method: this.requestMethod,
      url: this.requestUrl,
      headers: this.requestHeaders,
      body,
    }
    setTimeout(() => this.onloadend?.(), 0)
  }
}

const realXMLHttpRequest = globalThis.XMLHttpRequest

beforeEach(() => {
  emittedRequest = null
  localStorage.clear()
  ;(globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = RecordingXMLHttpRequest
})

afterAll(() => {
  ;(globalThis as { XMLHttpRequest: unknown }).XMLHttpRequest = realXMLHttpRequest
})

const USER_ID = '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355'

function makePhotoFile() {
  return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
}

function emitted(): EmittedRequest {
  expect(emittedRequest).not.toBeNull()
  return emittedRequest as EmittedRequest
}

describe("uploadProfileAvatar — ce qui part sur le réseau", () => {
  it("n'annonce jamais du JSON, sinon axios convertit le fichier en JSON", async () => {
    await uploadProfileAvatar(USER_ID, makePhotoFile())

    const contentType = emitted().headers['content-type']
    expect(contentType ?? '').not.toContain('application/json')
  })

  it('transmet bien le FormData, pas une chaîne JSON', async () => {
    await uploadProfileAvatar(USER_ID, makePhotoFile())

    const { body } = emitted()
    // Le symptôme exact du défaut : `transformRequest` remplaçait le FormData
    // par `JSON.stringify(formDataToJSON(data))`, une chaîne sans le fichier.
    expect(typeof body).not.toBe('string')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).getAll('file')).toHaveLength(1)
    expect((body as FormData).get('file')).toBeInstanceOf(File)
  })

  it("laisse le navigateur poser le Content-Type, boundary compris", async () => {
    await uploadProfileAvatar(USER_ID, makePhotoFile())

    // Aucun Content-Type émis par le code : c'est le navigateur qui pose
    // `multipart/form-data; boundary=…`. Poser `multipart/form-data` en dur
    // ici priverait le corps de son boundary et le rendrait illisible côté
    // serveur — une panne pour une autre.
    expect(emitted().headers['content-type']).toBeUndefined()
  })

  it('poste au chemin documenté avec le JWT', async () => {
    localStorage.setItem('access_token', 'test-jwt-token')

    await uploadProfileAvatar(USER_ID, makePhotoFile())

    expect(emitted().method).toBe('POST')
    expect(emitted().url).toBe(`/api/v1/profiles/${USER_ID}/avatar`)
    expect(emitted().headers.authorization).toBe('Bearer test-jwt-token')
  })
})

describe('apiClient — garde-fou central sur les corps FormData', () => {
  it("neutralise l'en-tête JSON même si l'appelant n'y pense pas", async () => {
    // Le prochain envoi de fichier (CV formateur, pièce justificative) ne doit
    // pas retomber dans le même trou faute d'avoir déclaré `Content-Type`.
    const formData = new FormData()
    formData.append('file', makePhotoFile())

    await apiClient.post('/some/future/upload', formData)

    const contentType = emitted().headers['content-type']
    expect(contentType ?? '').not.toContain('application/json')
    expect(emitted().body).toBeInstanceOf(FormData)
  })
})

describe('apiClient — les appels JSON restent inchangés', () => {
  it('annonce application/json et sérialise le corps pour un objet', async () => {
    await apiClient.post('/profiles/u/internal-notes', { content: 'note' })

    expect(emitted().headers['content-type']).toContain('application/json')
    expect(emitted().body).toBe('{"content":"note"}')
  })

  it('annonce application/json pour un PUT', async () => {
    await apiClient.put('/profiles/u/administrative', { firstName: 'Marie' })

    expect(emitted().headers['content-type']).toContain('application/json')
    expect(emitted().body).toBe('{"firstName":"Marie"}')
  })

  it("n'émet pas de corps ni de Content-Type parasite sur un GET", async () => {
    await apiClient.get('/profiles/avatar/constraints')

    expect(emitted().method).toBe('GET')
    expect(emitted().body).toBeNull()
  })
})
