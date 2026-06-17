/**
 * Tests for ContactsPage — Phase 8 communication-service
 *
 * Covers:
 * 1. Student sees mandatory contacts and cannot remove them
 * 2. Student activates a precontact
 * 3. Removing a contact closes the conversation (contact disparaît de la liste)
 * 4. Visibility preference updates contact rights (PATCH /contacts/:id/visibility)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const MANDATORY_CONTACT = {
  id: 'contact-mandatory-1',
  userId: 'rp-user-1',
  email: 'rp@visiomath.fr',
  displayName: 'Responsable Pédagogique',
  role: 'responsable_pedagogique',
  status: 'active' as const,
  mandatory: true,
  visibility: 'visible' as const,
}

const PRECONTACT = {
  id: 'contact-pre-1',
  userId: 'teacher-user-1',
  email: 'prof@test.com',
  displayName: 'M. Dupont',
  role: 'formateur',
  status: 'precontact' as const,
  mandatory: false,
  visibility: 'visible' as const,
}

const ACTIVE_OPTIONAL_CONTACT = {
  id: 'contact-active-1',
  userId: 'parent-user-1',
  email: 'parent@test.com',
  displayName: 'Parent Martin',
  role: 'parent_financeur',
  status: 'active' as const,
  mandatory: false,
  visibility: 'visible' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(AUTH_USER)
})

describe('ContactsPage', () => {
  // Spec 1 — Un contact mandatory: true n'a pas de bouton "Supprimer"
  it('student sees mandatory contacts and cannot remove them', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({
      data: [MANDATORY_CONTACT, ACTIVE_OPTIONAL_CONTACT],
    })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Responsable Pédagogique')).toBeDefined()
    })

    // Le contact obligatoire est affiché avec le badge "Obligatoire"
    expect(screen.getByText('Obligatoire')).toBeDefined()

    // Il ne doit y avoir qu'un seul bouton "Supprimer" (pour le contact optionnel)
    // et le contact obligatoire ne doit PAS en avoir un
    const deleteButtons = screen.queryAllByRole('button', { name: /supprimer/i })
    expect(deleteButtons).toHaveLength(1)

    // Vérifier que le bouton Supprimer affiché est bien pour le contact optionnel
    // en cliquant dessus et vérifiant que DELETE est appelé avec le bon id
    mockApiClient.delete = vi.fn().mockResolvedValue({ data: {} })
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/contacts/contact-active-1')
    })
    // Le contact obligatoire n'a pas été supprimé
    expect(mockApiClient.delete).not.toHaveBeenCalledWith('/contacts/contact-mandatory-1')
  })

  // Spec 2 — Clic sur "Activer" appelle POST /contacts/:id/activate
  it('student activates a precontact', async () => {
    const activatedContact = { ...PRECONTACT, status: 'active' as const }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PRECONTACT] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: activatedContact })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('M. Dupont')).toBeDefined()
    })

    // Le badge "Précontact" est visible
    expect(screen.getByText('Précontact')).toBeDefined()

    // Cliquer sur "Activer"
    const activateButton = screen.getByRole('button', { name: /activer/i })
    await userEvent.click(activateButton)

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/contacts/contact-pre-1/activate')
    })
  })

  // Spec 3 — DELETE /contacts/:id est appelé et le contact disparaît de la liste
  it('removing a contact closes the conversation', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [ACTIVE_OPTIONAL_CONTACT] })
    mockApiClient.delete = vi.fn().mockResolvedValue({ data: {} })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Parent Martin')).toBeDefined()
    })

    // Supprimer le contact
    const deleteButton = screen.getByRole('button', { name: /supprimer/i })
    await userEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/contacts/contact-active-1')
    })

    // Le contact doit avoir disparu de la liste
    await waitFor(() => {
      expect(screen.queryByText('Parent Martin')).toBeNull()
    })
  })

  // Spec 4 (visibility) — PATCH /contacts/:id/visibility est appelé quand la visibilité change
  it('visibility preference updates contact rights', async () => {
    const updatedContact = { ...ACTIVE_OPTIONAL_CONTACT, visibility: 'hidden' as const }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [ACTIVE_OPTIONAL_CONTACT] })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: updatedContact })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Parent Martin')).toBeDefined()
    })

    // Changer la visibilité via le select
    const visibilitySelect = screen.getByLabelText(/visibilité de parent martin/i)
    await userEvent.selectOptions(visibilitySelect, 'hidden')

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/contacts/contact-active-1/visibility',
        { visibility: 'hidden' },
      )
    })
  })

  // Test de rendu général
  it('shows empty state when no contacts exist', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Aucun contact disponible')).toBeDefined()
    })
  })

  it('shows error message when contacts fail to load', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les contacts')).toBeDefined()
    })
  })

  it('shows precontact badge and activate button for precontacts', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PRECONTACT] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('Précontact')).toBeDefined()
      expect(screen.getByRole('button', { name: /activer/i })).toBeDefined()
    })
  })

  it('does not show delete button for precontacts', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [PRECONTACT] })

    renderContacts()

    await waitFor(() => {
      expect(screen.getByText('M. Dupont')).toBeDefined()
    })

    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })
})
