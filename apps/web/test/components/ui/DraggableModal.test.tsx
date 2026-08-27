/**
 * Tests de DraggableModal — première fenêtre modale déplaçable du projet.
 * Couvre : rendu, fermeture par le bouton, fermeture par Échap, focus initial.
 * Le déplacement lui-même (pointer events) n'est pas simulable de façon
 * fiable en jsdom (pas de layout réel) — non testé ici, comportement visuel.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DraggableModal } from '../../../src/components/ui/DraggableModal'

describe('DraggableModal', () => {
  it('affiche le titre et le contenu', () => {
    render(
      <DraggableModal title="Mémo" onClose={vi.fn()}>
        <p>Contenu de la modale</p>
      </DraggableModal>,
    )

    expect(screen.getByRole('dialog', { name: 'Mémo' })).toBeDefined()
    expect(screen.getByText('Contenu de la modale')).toBeDefined()
  })

  it('pose le focus sur le bouton de fermeture au montage', () => {
    render(
      <DraggableModal title="Mémo" onClose={vi.fn()}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    expect(screen.getByLabelText('Fermer')).toHaveFocus()
  })

  it('appelle onClose au clic sur le bouton de fermeture', async () => {
    const handleClose = vi.fn()
    render(
      <DraggableModal title="Mémo" onClose={handleClose}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    await userEvent.click(screen.getByLabelText('Fermer'))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('appelle onClose à la touche Échap', async () => {
    const handleClose = vi.fn()
    render(
      <DraggableModal title="Mémo" onClose={handleClose}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    await userEvent.keyboard('{Escape}')

    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
