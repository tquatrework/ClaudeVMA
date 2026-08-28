/**
 * Tests — NotebookPage (carnet personnel du titulaire), après extraction de
 * `NotebookEntryList`/`NotebookSearchForm` (chantier « accès admin/parent au
 * carnet personnel », 2026-08-28). Vérifie que le refactor ne change aucun
 * comportement : chargement, vide, erreur, succès (ajout, suppression,
 * recherche).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NotebookPage from '../../src/pages/NotebookPage'
import { makeApiError, makeUseAuthReturn } from '../../src/test-helpers'
import type { NotebookEntry } from '../../src/api/pedagogicalLogNotebook'

vi.mock('../../src/api/pedagogicalLogNotebook')
vi.mock('../../src/hooks/useAuth')

import {
  fetchNotebookEntries,
  createNotebookEntry,
  deleteNotebookEntry,
} from '../../src/api/pedagogicalLogNotebook'
import { useAuth } from '../../src/hooks/useAuth'

const mockFetchNotebookEntries = vi.mocked(fetchNotebookEntries)
const mockCreateNotebookEntry = vi.mocked(createNotebookEntry)
const mockDeleteNotebookEntry = vi.mocked(deleteNotebookEntry)
const mockUseAuth = vi.mocked(useAuth)

const ENTRY: NotebookEntry = {
  id: 'entry-1',
  ownerId: 'owner-1',
  content: 'Réviser les intégrales',
  createdAt: '2026-08-01T10:00:00.000Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotebookPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = vi.fn(() => true)
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'owner-1', role: 'eleve' }))
})

describe('NotebookPage', () => {
  it('affiche un état de chargement puis la liste des entrées', async () => {
    mockFetchNotebookEntries.mockResolvedValue([ENTRY])
    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
    await waitFor(() => {
      expect(screen.getByText('Réviser les intégrales')).toBeDefined()
    })
  })

  it("affiche un état vide quand le carnet n'a aucune entrée", async () => {
    mockFetchNotebookEntries.mockResolvedValue([])
    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Aucune note pour l'instant")).toBeDefined()
    })
  })

  it('affiche un message d\'erreur générique sur un échec de chargement', async () => {
    mockFetchNotebookEntries.mockRejectedValue(makeApiError(500))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le carnet personnel')).toBeDefined()
    })
  })

  it('affiche « Accès refusé » sur un 403', async () => {
    mockFetchNotebookEntries.mockRejectedValue(makeApiError(403))
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('ajoute une nouvelle note et la place en tête de liste', async () => {
    mockFetchNotebookEntries.mockResolvedValue([])
    const newEntry: NotebookEntry = {
      id: 'entry-2',
      ownerId: 'owner-1',
      content: 'Nouvelle pensée',
      createdAt: '2026-08-05T10:00:00.000Z',
    }
    mockCreateNotebookEntry.mockResolvedValue(newEntry)
    renderPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Noter une pensée…')).toBeDefined()
    })

    await userEvent.type(screen.getByPlaceholderText('Noter une pensée…'), 'Nouvelle pensée')
    await userEvent.click(screen.getByRole('button', { name: /^noter$/i }))

    await waitFor(() => {
      expect(mockCreateNotebookEntry).toHaveBeenCalledWith({ content: 'Nouvelle pensée' })
      expect(screen.getByText('Nouvelle pensée')).toBeDefined()
    })
  })

  it('supprime une note après confirmation', async () => {
    mockFetchNotebookEntries.mockResolvedValue([ENTRY])
    mockDeleteNotebookEntry.mockResolvedValue(undefined)
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Réviser les intégrales')).toBeDefined()
    })

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    await waitFor(() => {
      expect(mockDeleteNotebookEntry).toHaveBeenCalledWith('entry-1')
      expect(screen.queryByText('Réviser les intégrales')).toBeNull()
    })
  })

  it('recherche par mot en transmettant q au serveur', async () => {
    mockFetchNotebookEntries.mockResolvedValue([ENTRY])
    renderPage()

    await waitFor(() => {
      expect(screen.getByLabelText(/rechercher un mot/i)).toBeDefined()
    })

    await userEvent.type(screen.getByLabelText(/rechercher un mot/i), 'intégrales')
    await userEvent.click(screen.getByRole('button', { name: /^rechercher$/i }))

    await waitFor(() => {
      expect(mockFetchNotebookEntries).toHaveBeenCalledWith({
        q: 'intégrales',
        from: undefined,
        to: undefined,
      })
    })
  })
})
