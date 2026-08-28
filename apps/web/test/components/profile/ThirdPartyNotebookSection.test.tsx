/**
 * Tests — ThirdPartyNotebookSection (chantier « accès admin/parent au carnet
 * personnel », 2026-08-28).
 *
 * Couvre la règle du projet « ne jamais afficher une section qui mènerait à
 * une découverte vide ou en erreur » : la section ne rend RIEN tant que
 * l'appel n'a pas réussi, quelle que soit la cause de l'échec (403, 404,
 * réseau). Elle rend un état vide **normal** (liste vide mais appel réussi)
 * différemment d'un accès refusé (aucun appel réussi → rien du tout).
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThirdPartyNotebookSection } from '../../../src/components/profile/ThirdPartyNotebookSection'
import { makeApiError } from '../../../src/test-helpers'
import type { NotebookEntry } from '../../../src/api/pedagogicalLogNotebook'

vi.mock('../../../src/api/pedagogicalLogNotebook')

import { fetchThirdPartyNotebookEntries } from '../../../src/api/pedagogicalLogNotebook'

const mockFetchThirdPartyNotebookEntries = vi.mocked(fetchThirdPartyNotebookEntries)

const ENTRY: NotebookEntry = {
  id: 'entry-1',
  ownerId: 'student-1',
  content: 'Réviser les intégrales',
  createdAt: '2026-08-01T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ThirdPartyNotebookSection', () => {
  it("n'affiche rien tant que l'appel n'a pas résolu, et rien du tout sur un échec (403)", async () => {
    mockFetchThirdPartyNotebookEntries.mockRejectedValue(makeApiError(403))
    const { container } = render(
      <ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />,
    )

    // Rien affiché avant résolution, ni après un échec.
    expect(container).toBeEmptyDOMElement()
    await waitFor(() => {
      expect(mockFetchThirdPartyNotebookEntries).toHaveBeenCalledWith('student-1', undefined)
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("n'affiche rien sur un échec 404 (réglage désactivé ou relation absente)", async () => {
    mockFetchThirdPartyNotebookEntries.mockRejectedValue(makeApiError(404))
    const { container } = render(
      <ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />,
    )

    await waitFor(() => {
      expect(mockFetchThirdPartyNotebookEntries).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it("n'appelle pas le serveur quand enabled=false", () => {
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled={false} />)
    expect(mockFetchThirdPartyNotebookEntries).not.toHaveBeenCalled()
  })

  it('affiche la section, avec le prénom du titulaire, après un chargement réussi', async () => {
    mockFetchThirdPartyNotebookEntries.mockResolvedValue([ENTRY])
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />)

    await waitFor(() => {
      expect(screen.getByText('Carnet personnel de Marie')).toBeDefined()
      expect(screen.getByText('Réviser les intégrales')).toBeDefined()
    })
  })

  it('affiche un état vide (normal) quand la liste est vide mais l\'appel réussit', async () => {
    mockFetchThirdPartyNotebookEntries.mockResolvedValue([])
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />)

    await waitFor(() => {
      expect(screen.getByText('Carnet personnel de Marie')).toBeDefined()
      expect(screen.getByText('Aucune note pour le moment')).toBeDefined()
    })
  })

  it("n'affiche aucun bouton Supprimer — lecture seule stricte", async () => {
    mockFetchThirdPartyNotebookEntries.mockResolvedValue([ENTRY])
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />)

    await waitFor(() => {
      expect(screen.getByText('Réviser les intégrales')).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })

  it('recherche par mot en transmettant q au serveur, en restant lecture seule', async () => {
    mockFetchThirdPartyNotebookEntries.mockResolvedValue([ENTRY])
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled ownerFirstName="Marie" />)

    await waitFor(() => {
      expect(screen.getByText('Carnet personnel de Marie')).toBeDefined()
    })

    await userEvent.type(screen.getByLabelText(/rechercher un mot/i), 'intégrales')
    await userEvent.click(screen.getByRole('button', { name: /^rechercher$/i }))

    await waitFor(() => {
      expect(mockFetchThirdPartyNotebookEntries).toHaveBeenLastCalledWith('student-1', {
        q: 'intégrales',
        from: undefined,
        to: undefined,
      })
    })
  })

  it('libellé générique quand le prénom du titulaire est inconnu', async () => {
    mockFetchThirdPartyNotebookEntries.mockResolvedValue([])
    render(<ThirdPartyNotebookSection ownerId="student-1" enabled />)

    await waitFor(() => {
      expect(screen.getByText('Carnet personnel')).toBeDefined()
    })
  })
})
