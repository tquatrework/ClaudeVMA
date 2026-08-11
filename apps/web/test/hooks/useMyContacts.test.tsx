/**
 * Tests de useMyContacts.
 *
 * Un seul appel, sans paramètre d'identifiant : `GET /relations/my-contacts` répond
 * pour l'utilisateur authentifié, tous rôles confondus. Le nom affichable est
 * construit ici une seule fois, et n'est jamais un UUID.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMyContacts } from '../../src/hooks/relations/useMyContacts'
import type { MyContact } from '../../src/types/relations'

vi.mock('../../src/api/relations')

import { fetchMyContacts } from '../../src/api/relations'

const mockFetchMyContacts = vi.mocked(fetchMyContacts)

const NAMED_CONTACT: MyContact = {
  userId: '89968837-c4bb-455e-b4e4-5a8c86c23a79',
  firstName: 'Nadia',
  lastName: 'Formatrice',
  relations: [{ kind: 'student_of_teacher', isPrincipalTeacher: true }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useMyContacts', () => {
  it('appelle la route sans aucun identifiant', async () => {
    mockFetchMyContacts.mockResolvedValue([NAMED_CONTACT])

    renderHook(() => useMyContacts())

    await waitFor(() => {
      expect(mockFetchMyContacts).toHaveBeenCalledWith()
    })
  })

  it('construit un nom affichable à partir du prénom et du nom', async () => {
    mockFetchMyContacts.mockResolvedValue([NAMED_CONTACT])

    const { result } = renderHook(() => useMyContacts())

    await waitFor(() => {
      expect(result.current.contacts[0].displayName).toBe('Nadia Formatrice')
    })
  })

  it("emploie un repli lisible quand le profil administratif manque, jamais l'UUID", async () => {
    mockFetchMyContacts.mockResolvedValue([
      { ...NAMED_CONTACT, firstName: null, lastName: null },
    ])

    const { result } = renderHook(() => useMyContacts())

    await waitFor(() => {
      expect(result.current.contacts[0].displayName).toBe('Contact (nom non renseigné)')
    })
    expect(result.current.contacts[0].displayName).not.toContain(NAMED_CONTACT.userId)
  })

  it('rend une liste vide pour un compte sans aucun lien', async () => {
    mockFetchMyContacts.mockResolvedValue([])

    const { result } = renderHook(() => useMyContacts())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.contacts).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('expose un message en français quand la lecture échoue', async () => {
    mockFetchMyContacts.mockRejectedValue({ response: { status: 500 } })

    const { result } = renderHook(() => useMyContacts())

    await waitFor(() => {
      expect(result.current.error).toMatch(/serveur rencontre un problème/i)
    })
    expect(result.current.contacts).toEqual([])
  })
})
