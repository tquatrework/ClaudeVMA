/**
 * Tests unitaires pour apps/web/src/api/communication.ts
 *
 * Vérifie que chaque fonction appelle la bonne route HTTP avec les bons paramètres.
 *
 * Couverture :
 * - fetchContacts()             → GET /contacts
 * - activateContact(id)         → POST /contacts/:id/activate
 * - deleteContact(id)           → DELETE /contacts/:id
 * - updateContactVisibility(id) → PATCH /contacts/:id/visibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client axios partagé
vi.mock('../src/api/client')

import apiClient from '../src/api/client'
import {
  fetchContacts,
  activateContact,
  deleteContact,
  updateContactVisibility,
  type Contact,
  type UpdateVisibilityPayload,
} from '../src/api/communication'

const mockApiClient = vi.mocked(apiClient)

// Données de test réutilisables
const CONTACT_ACTIVE: Contact = {
  id: 'contact-uuid-1',
  userId: 'user-uuid-1',
  email: 'formateur@visiomath.fr',
  displayName: 'M. Dupont',
  role: 'formateur',
  status: 'active',
  mandatory: false,
  visibility: 'visible',
}

const CONTACT_MANDATORY: Contact = {
  id: 'contact-uuid-rp',
  userId: 'rp-uuid-1',
  email: 'rp@visiomath.fr',
  displayName: 'Responsable Pédagogique',
  role: 'responsable_pedagogique',
  status: 'active',
  mandatory: true,
  visibility: 'visible',
}

const PRECONTACT: Contact = {
  id: 'contact-uuid-pre',
  userId: 'teacher-uuid-2',
  email: 'prof2@test.com',
  displayName: 'Mme Bernard',
  role: 'formateur',
  status: 'precontact',
  mandatory: false,
  visibility: 'visible',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchContacts', () => {
  it('appelle GET /contacts et retourne la liste des contacts', async () => {
    const contactList = [CONTACT_ACTIVE, CONTACT_MANDATORY]
    mockApiClient.get = vi.fn().mockResolvedValue({ data: contactList })

    const result = await fetchContacts()

    expect(mockApiClient.get).toHaveBeenCalledOnce()
    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts')
    expect(result).toEqual(contactList)
  })

  it('retourne un tableau vide quand aucun contact n\'existe', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    const result = await fetchContacts()

    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts')
    expect(result).toEqual([])
  })

  it('propage l\'erreur en cas d\'échec HTTP', async () => {
    const httpError = { response: { status: 401 } }
    mockApiClient.get = vi.fn().mockRejectedValue(httpError)

    await expect(fetchContacts()).rejects.toEqual(httpError)
    expect(mockApiClient.get).toHaveBeenCalledWith('/contacts')
  })
})

describe('activateContact', () => {
  it('appelle POST /contacts/:id/activate et retourne le contact activé', async () => {
    const activatedContact: Contact = { ...PRECONTACT, status: 'active' }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: activatedContact })

    const result = await activateContact('contact-uuid-pre')

    expect(mockApiClient.post).toHaveBeenCalledOnce()
    expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/contact-uuid-pre/activate')
    expect(result).toEqual(activatedContact)
    expect(result.status).toBe('active')
  })

  it('construit l\'URL correctement pour différents identifiants', async () => {
    const differentContactId = 'another-contact-id-456'
    const activatedContact: Contact = { ...PRECONTACT, id: differentContactId, status: 'active' }
    mockApiClient.post = vi.fn().mockResolvedValue({ data: activatedContact })

    await activateContact(differentContactId)

    expect(mockApiClient.post).toHaveBeenCalledWith(
      `/contacts/${differentContactId}/activate`,
    )
  })

  it('propage l\'erreur 403 si le contact ne peut pas être activé', async () => {
    const forbiddenError = { response: { status: 403 } }
    mockApiClient.post = vi.fn().mockRejectedValue(forbiddenError)

    await expect(activateContact('contact-uuid-pre')).rejects.toEqual(forbiddenError)
  })
})

describe('deleteContact', () => {
  it('appelle DELETE /contacts/:id', async () => {
    mockApiClient.delete = vi.fn().mockResolvedValue({ data: {} })

    await deleteContact('contact-uuid-1')

    expect(mockApiClient.delete).toHaveBeenCalledOnce()
    expect(mockApiClient.delete).toHaveBeenCalledWith('/contacts/contact-uuid-1')
  })

  it('ne retourne pas de valeur (void)', async () => {
    mockApiClient.delete = vi.fn().mockResolvedValue({ data: {} })

    const result = await deleteContact('contact-uuid-1')

    expect(result).toBeUndefined()
  })

  it('ne peut pas supprimer un contact obligatoire — propage l\'erreur 403', async () => {
    const forbiddenError = { response: { status: 403, data: { message: 'Contact obligatoire' } } }
    mockApiClient.delete = vi.fn().mockRejectedValue(forbiddenError)

    await expect(deleteContact(CONTACT_MANDATORY.id)).rejects.toEqual(forbiddenError)
    expect(mockApiClient.delete).toHaveBeenCalledWith(`/contacts/${CONTACT_MANDATORY.id}`)
  })

  it('propage l\'erreur 404 si le contact n\'existe pas', async () => {
    const notFoundError = { response: { status: 404 } }
    mockApiClient.delete = vi.fn().mockRejectedValue(notFoundError)

    await expect(deleteContact('nonexistent-id')).rejects.toEqual(notFoundError)
  })
})

describe('updateContactVisibility', () => {
  it('appelle PATCH /contacts/:id/visibility avec le payload de visibilité', async () => {
    const updatedContact: Contact = { ...CONTACT_ACTIVE, visibility: 'hidden' }
    const visibilityPayload: UpdateVisibilityPayload = { visibility: 'hidden' }
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: updatedContact })

    const result = await updateContactVisibility('contact-uuid-1', visibilityPayload)

    expect(mockApiClient.patch).toHaveBeenCalledOnce()
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/contacts/contact-uuid-1/visibility',
      { visibility: 'hidden' },
    )
    expect(result).toEqual(updatedContact)
    expect(result.visibility).toBe('hidden')
  })

  it('accepte la valeur "visible" pour rétablir la visibilité', async () => {
    const updatedContact: Contact = { ...CONTACT_ACTIVE, visibility: 'visible' }
    const visibilityPayload: UpdateVisibilityPayload = { visibility: 'visible' }
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: updatedContact })

    const result = await updateContactVisibility('contact-uuid-1', visibilityPayload)

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/contacts/contact-uuid-1/visibility',
      { visibility: 'visible' },
    )
    expect(result.visibility).toBe('visible')
  })

  it('construit l\'URL correctement quel que soit l\'identifiant', async () => {
    const targetContactId = 'target-contact-xyz'
    const updatedContact: Contact = { ...CONTACT_ACTIVE, id: targetContactId, visibility: 'hidden' }
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: updatedContact })

    await updateContactVisibility(targetContactId, { visibility: 'hidden' })

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      `/contacts/${targetContactId}/visibility`,
      { visibility: 'hidden' },
    )
  })

  it('propage l\'erreur en cas d\'échec HTTP', async () => {
    const serverError = { response: { status: 500 } }
    mockApiClient.patch = vi.fn().mockRejectedValue(serverError)

    await expect(
      updateContactVisibility('contact-uuid-1', { visibility: 'hidden' }),
    ).rejects.toEqual(serverError)
  })
})
