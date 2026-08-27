/**
 * Tests de DraggableModal — première fenêtre modale déplaçable du projet.
 * Couvre : rendu, fermeture par le bouton, fermeture par Échap, focus initial.
 * Le déplacement lui-même (pointer events) n'est pas simulable de façon
 * fiable en jsdom (pas de layout réel) — non testé ici, comportement visuel,
 * sauf pour le cas de non-régression ci-dessous, qui ne dépend pas de
 * `setPointerCapture` (absent de jsdom).
 */

import { render, screen, fireEvent } from '@testing-library/react'
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

  it("ne démarre pas de glisser quand le pointeur descend sur le bouton de fermeture", () => {
    // Bug réel : le bandeau d'en-tête démarrait un glisser (et capturait le
    // pointeur) même quand le `pointerdown` provenait du bouton ✕ qui lui est
    // imbriqué — en navigateur réel, cela redirige le `click` de
    // compatibilité vers le bandeau et `onClose` ne se déclenche jamais. Ce
    // test vérifie la cause directement (aucun état de glisser ne démarre
    // depuis le bouton), sans dépendre de `setPointerCapture` — absent de
    // jsdom, donc impossible à observer via la redirection du clic elle-même.
    render(
      <DraggableModal title="Mémo" onClose={vi.fn()}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    const closeButton = screen.getByLabelText('Fermer')
    const dialog = screen.getByRole('dialog')
    const header = closeButton.parentElement as HTMLElement

    fireEvent.pointerDown(closeButton, { clientX: 100, clientY: 100, pointerId: 1, button: 0 })
    fireEvent.pointerMove(header, { clientX: 260, clientY: 260, pointerId: 1 })

    expect(dialog.style.transform).toBe('translate(-50%, -50%) translate(0px, 0px)')
  })

  it('capture le pointeur pour un glisser démarré ailleurs sur le bandeau (titre, zone vide)', () => {
    // jsdom n'implémente pas PointerEvent : `clientX`/`clientY` transmis à
    // `fireEvent.pointerDown` restent `undefined` (vérifié), donc un test par
    // coordonnées ne serait pas fiable ici — cohérent avec le commentaire de
    // tête. On observe directement l'appel à `setPointerCapture`, en le
    // posant nous-mêmes sur le nœud (absent par défaut de jsdom).
    render(
      <DraggableModal title="Mémo" onClose={vi.fn()}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    const header = screen.getByText('Mémo').parentElement as HTMLElement
    const setPointerCapture = vi.fn()
    ;(header as unknown as { setPointerCapture: typeof setPointerCapture }).setPointerCapture =
      setPointerCapture

    fireEvent.pointerDown(header, { pointerId: 1, button: 0 })

    expect(setPointerCapture).toHaveBeenCalledTimes(1)
  })

  it('ne capture pas le pointeur quand le pointerdown provient du bouton de fermeture', () => {
    render(
      <DraggableModal title="Mémo" onClose={vi.fn()}>
        <p>Contenu</p>
      </DraggableModal>,
    )

    const closeButton = screen.getByLabelText('Fermer')
    const header = closeButton.parentElement as HTMLElement
    const setPointerCapture = vi.fn()
    ;(header as unknown as { setPointerCapture: typeof setPointerCapture }).setPointerCapture =
      setPointerCapture

    fireEvent.pointerDown(closeButton, { pointerId: 1, button: 0 })

    expect(setPointerCapture).not.toHaveBeenCalled()
  })
})
