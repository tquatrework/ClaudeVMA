/**
 * Tests — NotebookEntryList, extrait de NotebookPage (chantier « accès
 * admin/parent au carnet personnel », 2026-08-28).
 *
 * Couvre : état vide (message contextualisé), rendu des entrées, bouton
 * « Supprimer » présent uniquement quand `onDelete` est fourni (permet la
 * réutilisation en lecture seule sans booléen `readOnly` redondant).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NotebookEntryList } from '../../../src/components/notebook/NotebookEntryList'
import type { NotebookEntry } from '../../../src/api/pedagogicalLogNotebook'

const ENTRIES: NotebookEntry[] = [
  { id: 'entry-1', ownerId: 'owner-1', content: 'Réviser les intégrales', createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'entry-2', ownerId: 'owner-1', content: 'Penser aux vecteurs', createdAt: '2026-08-02T10:00:00.000Z' },
]

describe('NotebookEntryList', () => {
  it('affiche le message vide quand il n\'y a aucune entrée', () => {
    render(<NotebookEntryList entries={[]} emptyMessage="Aucune note pour l'instant" />)
    expect(screen.getByText("Aucune note pour l'instant")).toBeDefined()
  })

  it('affiche le contenu de chaque entrée', () => {
    render(<NotebookEntryList entries={ENTRIES} emptyMessage="vide" />)
    expect(screen.getByText('Réviser les intégrales')).toBeDefined()
    expect(screen.getByText('Penser aux vecteurs')).toBeDefined()
  })

  it('affiche un bouton Supprimer par entrée quand onDelete est fourni, et l\'appelle avec le bon id', async () => {
    const onDelete = vi.fn()
    render(<NotebookEntryList entries={ENTRIES} emptyMessage="vide" onDelete={onDelete} />)

    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i })
    expect(deleteButtons).toHaveLength(2)

    await userEvent.click(deleteButtons[0])
    expect(onDelete).toHaveBeenCalledWith('entry-1')
  })

  it('n\'affiche aucun bouton Supprimer sans onDelete (lecture seule)', () => {
    render(<NotebookEntryList entries={ENTRIES} emptyMessage="vide" />)
    expect(screen.queryByRole('button', { name: /supprimer/i })).toBeNull()
  })
})
