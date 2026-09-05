/**
 * Tests unitaires pour apps/web/src/api/contacts.ts
 *
 * Vérifie que chaque fonction appelle la bonne route HTTP avec les bons paramètres.
 *
 * Extrait de `apiClient.communication.test.ts` le 2026-09-05, en même temps que le
 * module source (docs/architecture/contacts-messagerie.md, 2026-09-04) : l'ancien
 * modèle ContactPolicy (précontact/mandatory/visibilité) n'existe plus côté serveur —
 * remplacé par un Contact bidirectionnel avec cycle de vie de demande.
 *
 * Couverture :
 * - fetchContacts()                         → GET /contacts
 * - breakContact(id)                        → POST /contacts/:id/break
 * - searchContactByLoginIdentifier(value)   → GET /contacts/search/by-login-identifier?value=
 * - searchContactByName(q)                  → GET /contacts/search/by-name?q=
 * - fetchIncomingContactRequests()          → GET /contacts/requests/incoming
 * - fetchOutgoingContactRequests()          → GET /contacts/requests/outgoing
 * - sendContactRequest(targetId)            → POST /contacts/requests
 * - acceptContactRequest(id)                → POST /contacts/requests/:id/accept
 * - declineContactRequest(id)               → POST /contacts/requests/:id/decline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client axios partagé
vi.mock('../src/api/client')

import apiClient from '../src/api/client'
import {
  fetchContacts,
  breakContact,
  searchContactByLoginIdentifier,
  searchContactByName,
  fetchIncomingContactRequests,
  fetchOutgoingContactRequests,
  sendContactRequest,
  acceptContactRequest,
  declineContactRequest,
  type Contact,
  type ContactRequest,
} from '../src/api/contacts'

const mockApiClient = vi.mocked(apiClient)

const ACTIVE_CONTACT: Contact = {
  id: 'contact-uuid-1',
  counterpartId: 'user-uuid-1',
  counterpartName: { firstName: 'Camille', lastName: 'Formateur' },
  status: 'active',
  origin: 'default',
  createdAt: '2026-09-01T00:00:00.000Z',
  brokenAt: null,
}

const PENDING_REQUEST: ContactRequest = {
  id: 'request-uuid-1',
  counterpartId: 'user-uuid-2',
  counterpartName: { firstName: 'Alex', lastName: 'Martin' },
  status: 'pending',
  createdAt: '2026-09-02T00:00:00.000Z',
  respondedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchContacts', () => {
  it('appelle GET /contacts et retourne la liste des contacts actifs', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [ACTIVE_CONTACT] })

    const result = await fetchContacts()

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts')
    expect(result).toEqual([ACTIVE_CONTACT])
  })

  it('propage l\'erreur en cas d\'échec HTTP', async () => {
    const httpError = { response: { status: 401 } }
    mockApiClient.get = vi.fn().mockRejectedValue(httpError)

    await expect(fetchContacts()).rejects.toEqual(httpError)
  })
})

describe('breakContact', () => {
  it('appelle POST /contacts/:id/break et retourne le contact rompu', async () => {
    const brokenContact: Contact = { ...ACTIVE_CONTACT, status: 'broken', brokenAt: '2026-09-05T00:00:00.000Z' }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: brokenContact })

    const result = await breakContact('contact-uuid-1')

    expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/contact-uuid-1/break')
    expect(result.status).toBe('broken')
  })

  it('propage l\'erreur 404 si le contact n\'existe pas pour cet appelant', async () => {
    const notFoundError = { response: { status: 404 } }
    mockApiClient.post = vi.fn().mockRejectedValue(notFoundError)

    await expect(breakContact('nonexistent-id')).rejects.toEqual(notFoundError)
  })
})

describe('searchContactByLoginIdentifier', () => {
  it('appelle GET /contacts/search/by-login-identifier avec value en paramètre', async () => {
    const response = {
      found: true,
      result: { userId: 'user-uuid-3', firstName: 'Dana', lastName: 'Petit', loginIdentifier: 'dana.petit' },
    }
    mockApiClient.get = vi.fn().mockResolvedValue({ data: response })

    const result = await searchContactByLoginIdentifier('dana.petit')

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts/search/by-login-identifier', {
      params: { value: 'dana.petit' },
    })
    expect(result).toEqual(response)
  })

  it('retourne found: false quand personne ne correspond', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: { found: false, result: null } })

    const result = await searchContactByLoginIdentifier('inconnu')

    expect(result.found).toBe(false)
    expect(result.result).toBeNull()
  })
})

describe('searchContactByName', () => {
  it('appelle GET /contacts/search/by-name avec q en paramètre', async () => {
    const response = { results: [{ userId: 'user-uuid-4', firstName: 'Sam', lastName: 'Dupont', loginIdentifier: 'sam.dupont' }] }
    mockApiClient.get = vi.fn().mockResolvedValue({ data: response })

    const result = await searchContactByName('Sam Dupont')

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts/search/by-name', {
      params: { q: 'Sam Dupont' },
    })
    expect(result).toEqual(response)
  })

  it('un tableau de résultats vide est un cas normal', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: { results: [] } })

    const result = await searchContactByName('Personne Inconnue')

    expect(result.results).toEqual([])
  })
})

describe('fetchIncomingContactRequests / fetchOutgoingContactRequests', () => {
  it('appelle GET /contacts/requests/incoming', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PENDING_REQUEST] })

    const result = await fetchIncomingContactRequests()

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts/requests/incoming')
    expect(result).toEqual([PENDING_REQUEST])
  })

  it('appelle GET /contacts/requests/outgoing', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PENDING_REQUEST] })

    const result = await fetchOutgoingContactRequests()

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts/requests/outgoing')
    expect(result).toEqual([PENDING_REQUEST])
  })
})

describe('sendContactRequest', () => {
  it('appelle POST /contacts/requests avec targetId', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: PENDING_REQUEST })

    const result = await sendContactRequest('user-uuid-2')

    expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests', { targetId: 'user-uuid-2' })
    expect(result).toEqual(PENDING_REQUEST)
  })

  it('propage l\'erreur 403 en cas de blocage (pénalité de refus)', async () => {
    const blockedError = {
      response: {
        status: 403,
        data: { message: 'Votre demande a été refusée récemment : vous pourrez la renouveler à partir du 2026-10-05T00:00:00.000Z' },
      },
    }
    mockApiClient.post = vi.fn().mockRejectedValue(blockedError)

    await expect(sendContactRequest('user-uuid-2')).rejects.toEqual(blockedError)
  })
})

describe('acceptContactRequest / declineContactRequest', () => {
  it('appelle POST /contacts/requests/:id/accept', async () => {
    const accepted: ContactRequest = { ...PENDING_REQUEST, status: 'accepted', respondedAt: '2026-09-03T00:00:00.000Z' }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: accepted })

    const result = await acceptContactRequest('request-uuid-1')

    expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests/request-uuid-1/accept')
    expect(result.status).toBe('accepted')
  })

  it('appelle POST /contacts/requests/:id/decline', async () => {
    const declined: ContactRequest = { ...PENDING_REQUEST, status: 'declined', respondedAt: '2026-09-03T00:00:00.000Z' }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: declined })

    const result = await declineContactRequest('request-uuid-1')

    expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests/request-uuid-1/decline')
    expect(result.status).toBe('declined')
  })
})
