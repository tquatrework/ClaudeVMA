/**
 * Tests — NotebookSearchForm, extrait de NotebookPage (chantier « accès
 * admin/parent au carnet personnel », 2026-08-28). Composant contrôlé pur :
 * aucun appel réseau, seulement des callbacks.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps, FormEvent } from 'react'
import { NotebookSearchForm } from '../../../src/components/notebook/NotebookSearchForm'

function renderForm(overrides: Partial<ComponentProps<typeof NotebookSearchForm>> = {}) {
  const props = {
    idPrefix: 'test',
    searchWord: '',
    onSearchWordChange: vi.fn(),
    searchDate: '',
    onSearchDateChange: vi.fn(),
    onSubmit: vi.fn((event: FormEvent) => event.preventDefault()),
    onReset: vi.fn(),
    isSearching: false,
    hasActiveSearch: false,
    ...overrides,
  }
  render(<NotebookSearchForm {...props} />)
  return props
}

describe('NotebookSearchForm', () => {
  it('affiche les deux champs de recherche et le bouton Rechercher', () => {
    renderForm()
    expect(screen.getByLabelText(/rechercher un mot/i)).toBeDefined()
    expect(screen.getByLabelText(/rechercher une date/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /rechercher/i })).toBeDefined()
  })

  it('ne montre pas le bouton Réinitialiser sans recherche active', () => {
    renderForm({ hasActiveSearch: false })
    expect(screen.queryByRole('button', { name: /réinitialiser/i })).toBeNull()
  })

  it('montre le bouton Réinitialiser et l\'appelle au clic quand une recherche est active', async () => {
    const props = renderForm({ hasActiveSearch: true })
    const resetButton = screen.getByRole('button', { name: /réinitialiser/i })
    await userEvent.click(resetButton)
    expect(props.onReset).toHaveBeenCalledTimes(1)
  })

  it('appelle onSearchWordChange à la saisie', async () => {
    const props = renderForm()
    await userEvent.type(screen.getByLabelText(/rechercher un mot/i), 'x')
    expect(props.onSearchWordChange).toHaveBeenCalled()
  })

  it('désactive le bouton Rechercher pendant une recherche en cours', () => {
    renderForm({ isSearching: true })
    expect(screen.getByRole('button', { name: /recherche…/i })).toBeDisabled()
  })
})
