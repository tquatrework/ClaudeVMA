/**
 * Tests for ContactsPage — refonte Contacts (docs/architecture/contacts-messagerie.md,
 * 2026-09-04). Remplace intégralement l'ancienne suite écrite pour le modèle ContactPolicy
 * (précontact/mandatory/visibilité), qui n'existe plus côté serveur.
 *
 * Covers:
 * 1. "Mes contacts" — liste les contacts actifs, avec noms résolus (jamais un UUID)
 * 2. "Mes contacts" — rompre un contact (avec confirmation) appelle POST /contacts/:id/break
 * 3. "Demandes" — accepter une demande reçue appelle POST /contacts/requests/:id/accept
 * 4. "Demandes" — refuser une demande reçue appelle POST /contacts/requests/:id/decline
 * 5. "Demandes" — les demandes envoyées sont affichées en lecture seule avec leur statut
 * 6. "Trouver un contact" — recherche par nom puis envoi d'une demande
 * 7. États vide / erreur
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ContactsPage from '../../src/pages/ContactsPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const AUTH_USER = {
  user: {
    id: 'student-1',
    email: 'eleve@test.com',
    role: 'eleve' as const,
    validationStatus: 'active' as const,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => false),
  isInternalRole: vi.fn(() => false),
}

function renderContacts() {
  return render(
    <MemoryRouter>
      <ContactsPage />
    </MemoryRouter>,
  )
}

const ACTIVE_CONTACT = {
  id: 'contact-active-1',
  counterpartId: 'teacher-user-1',
  counterpartName: { firstName: 'Camille', lastName: 'Formateur' },
  status: 'active' as const,
  origin: 'default' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  brokenAt: null,
}

const INCOMING_REQUEST = {
  id: 'request-in-1',
  counterpartId: 'parent-user-1',
  counterpartName: { firstName: 'Alex', lastName: 'Martin' },
  status: 'pending' as const,
  createdAt: '2026-09-02T00:00:00.000Z',
  respondedAt: null,
}

const OUTGOING_REQUEST = {
  id: 'request-out-1',
  counterpartId: 'teacher-user-2',
  counterpartName: { firstName: 'Dana', lastName: 'Petit' },
  status: 'pending' as const,
  createdAt: '2026-09-03T00:00:00.000Z',
  respondedAt: null,
}

function mockGetByUrl(map: Record<string, unknown>) {
  mockApiClient.get = vi.fn().mockImplementation((url: string) => {
    if (url in map) return Promise.resolve({ data: map[url] })
    return Promise.reject(new Error(`Unmocked GET ${url}`))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(AUTH_USER)
})

describe('ContactsPage — Mes contacts', () => {
  it('affiche les contacts actifs avec un nom résolu, jamais un UUID', async () => {
    mockGetByUrl({ '/contacts': [ACTIVE_CONTACT] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Camille Formateur')).toBeDefined()
    })
    expect(screen.queryByText('teacher-user-1')).toBeNull()
  })

  it('rompt un contact après confirmation, qui disparaît de la liste', async () => {
    mockGetByUrl({ '/contacts': [ACTIVE_CONTACT] })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { ...ACTIVE_CONTACT, status: 'broken', brokenAt: '2026-09-05T00:00:00.000Z' },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Camille Formateur')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rompre/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/contact-active-1/break')
    })
    await waitFor(() => {
      expect(screen.queryByText('Camille Formateur')).toBeNull()
    })
  })

  it("n'appelle pas l'API si la confirmation est annulée", async () => {
    mockGetByUrl({ '/contacts': [ACTIVE_CONTACT] })
    mockApiClient.post = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Camille Formateur')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /rompre/i }))

    expect(mockApiClient.post).not.toHaveBeenCalled()
  })

  it('affiche un état vide quand aucun contact actif', async () => {
    mockGetByUrl({ '/contacts': [] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText(/pas encore de contact actif/i)).toBeDefined()
    })
  })

  it('affiche une erreur si le chargement échoue', async () => {
    // Statut sans message métier ni mapping dédié (getErrorMessage) : retombe sur le
    // message de secours fourni par useContacts.
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 418 } })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText(/impossible de charger vos contacts/i)).toBeDefined()
    })
  })
})

describe('ContactsPage — Demandes', () => {
  it('accepte une demande reçue, qui disparaît de la liste des demandes en attente', async () => {
    mockGetByUrl({
      '/contacts': [],
      '/contacts/requests/incoming': [INCOMING_REQUEST],
      '/contacts/requests/outgoing': [],
    })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { ...INCOMING_REQUEST, status: 'accepted', respondedAt: '2026-09-04T00:00:00.000Z' },
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Demandes' }))

    await waitFor(() => {
      expect(screen.getByText('Alex Martin')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests/request-in-1/accept')
    })
    await waitFor(() => {
      expect(screen.queryByText('Alex Martin')).toBeNull()
    })
  })

  it('refuse une demande reçue', async () => {
    mockGetByUrl({
      '/contacts': [],
      '/contacts/requests/incoming': [INCOMING_REQUEST],
      '/contacts/requests/outgoing': [],
    })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: { ...INCOMING_REQUEST, status: 'declined', respondedAt: '2026-09-04T00:00:00.000Z' },
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Demandes' }))

    await waitFor(() => {
      expect(screen.getByText('Alex Martin')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests/request-in-1/decline')
    })
  })

  it('affiche les demandes envoyées en lecture seule, avec leur statut', async () => {
    mockGetByUrl({
      '/contacts': [],
      '/contacts/requests/incoming': [],
      '/contacts/requests/outgoing': [OUTGOING_REQUEST],
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Demandes' }))

    await waitFor(() => {
      expect(screen.getByText('Dana Petit')).toBeDefined()
    })
    expect(screen.getByText('En attente')).toBeDefined()
    // Lecture seule : pas de bouton accepter/refuser pour une demande sortante.
    expect(screen.queryByRole('button', { name: /accepter/i })).toBeNull()
  })
})

describe('ContactsPage — Trouver un contact', () => {
  it('recherche par nom puis envoie une demande de contact', async () => {
    mockGetByUrl({ '/contacts': [] })
    mockApiClient.get = vi.fn().mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/contacts') return Promise.resolve({ data: [] })
      if (url === '/contacts/search/by-name' && config?.params?.q === 'Dana') {
        return Promise.resolve({
          data: { results: [{ userId: 'user-uuid-9', firstName: 'Dana', lastName: 'Petit', loginIdentifier: 'dana.petit' }] },
        })
      }
      return Promise.reject(new Error(`Unmocked GET ${url}`))
    })
    mockApiClient.post = vi.fn().mockResolvedValue({
      data: {
        id: 'request-new-1',
        counterpartId: 'user-uuid-9',
        counterpartName: { firstName: 'Dana', lastName: 'Petit' },
        status: 'pending',
        createdAt: '2026-09-05T00:00:00.000Z',
        respondedAt: null,
      },
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Trouver un contact' }))

    await userEvent.type(screen.getByPlaceholderText(/camille durand/i), 'Dana')
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText('Dana Petit')).toBeDefined()
      expect(screen.getByText('dana.petit')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /demander en contact/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/requests', { targetId: 'user-uuid-9' })
    })
    // Le bouton passe à "Demande envoyée" et se désactive — requête via getByRole
    // (getByText échouerait sur plusieurs correspondances : le texte d'introduction du
    // panneau contient lui aussi la phrase "demande envoyée").
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /demande envoyée/i })).toBeDisabled()
    })
  })

  it("affiche un message clair quand l'envoi échoue à cause d'un blocage (403)", async () => {
    mockGetByUrl({ '/contacts': [] })
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/contacts') return Promise.resolve({ data: [] })
      if (url === '/contacts/search/by-name') {
        return Promise.resolve({
          data: { results: [{ userId: 'user-uuid-9', firstName: 'Dana', lastName: 'Petit', loginIdentifier: 'dana.petit' }] },
        })
      }
      return Promise.reject(new Error(`Unmocked GET ${url}`))
    })
    mockApiClient.post = vi.fn().mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Cette personne a refusé votre demande à plusieurs reprises : vous ne pouvez plus la solliciter' },
      },
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Trouver un contact' }))
    await userEvent.type(screen.getByPlaceholderText(/camille durand/i), 'Dana')
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText('Dana Petit')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /demander en contact/i }))

    await waitFor(() => {
      expect(screen.getByText(/refusé votre demande à plusieurs reprises/i)).toBeDefined()
    })
    // Le bouton reste désactivé après ce refus explicite du serveur.
    expect(screen.getByRole('button', { name: /demander en contact/i })).toBeDisabled()
  })

  it('recherche sans résultat affiche un message explicite, pas une erreur', async () => {
    mockGetByUrl({ '/contacts': [] })
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/contacts') return Promise.resolve({ data: [] })
      if (url === '/contacts/search/by-name') return Promise.resolve({ data: { results: [] } })
      return Promise.reject(new Error(`Unmocked GET ${url}`))
    })

    renderContacts()

    await userEvent.click(screen.getByRole('tab', { name: 'Trouver un contact' }))
    await userEvent.type(screen.getByPlaceholderText(/camille durand/i), 'Personne Inconnue')
    await userEvent.click(screen.getByRole('button', { name: /rechercher/i }))

    await waitFor(() => {
      expect(screen.getByText(/aucune personne trouvée/i)).toBeDefined()
    })
  })
})

describe('ContactsPage — raccourci "Demande de professeur" (retiré le 2026-09-05)', () => {
  it("n'affiche plus le raccourci pour l'élève", async () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_USER,
      hasRole: vi.fn((...roles: string[]) => roles.includes('eleve')),
    })
    mockGetByUrl({ '/contacts': [] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText(/pas encore de contact actif/i)).toBeDefined()
    })
    expect(screen.queryByText('Faire une demande')).toBeNull()
    expect(screen.queryByRole('link', { name: /nouvelle demande/i })).toBeNull()
  })

  it("n'affiche plus le raccourci pour le parent financeur", async () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_USER,
      hasRole: vi.fn((...roles: string[]) => roles.includes('parent_financeur')),
    })
    mockGetByUrl({ '/contacts': [] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText(/pas encore de contact actif/i)).toBeDefined()
    })
    expect(screen.queryByText('Faire une demande')).toBeNull()
    expect(screen.queryByRole('link', { name: /nouvelle demande/i })).toBeNull()
  })

  it('reste affiché pour le responsable pédagogique, non concerné par le retrait', async () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_USER,
      hasRole: vi.fn((...roles: string[]) => roles.includes('responsable_pedagogique')),
    })
    mockGetByUrl({ '/contacts': [] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Faire une demande')).toBeDefined()
    })
    expect(screen.getByRole('link', { name: /nouvelle demande/i })).toHaveProperty(
      'pathname',
      '/teacher-requests',
    )
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
