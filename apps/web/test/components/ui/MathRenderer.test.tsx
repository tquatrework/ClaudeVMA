/**
 * Tests de MathRenderer (rendu KaTeX).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MathRenderer } from '../../../src/components/ui/MathRenderer'

describe('MathRenderer', () => {
  it('rend une formule valide sans lever d\'erreur', () => {
    const { container } = render(<MathRenderer latex="x^2 + y^2 = z^2" />)
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('affiche un repli lisible pour un LaTeX invalide, sans faire planter la page', () => {
    render(<MathRenderer latex="\\frac{1" />)
    expect(screen.getByText(/formule illisible/i)).toBeDefined()
  })

  it('accepte le mode bloc (displayMode)', () => {
    const { container } = render(<MathRenderer latex="\\int_0^1 x \\; dx" displayMode />)
    expect(container.querySelector('.katex-display')).not.toBeNull()
  })
})
