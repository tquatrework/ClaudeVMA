/**
 * Tests de MemoFormulaInput — saisie de formule via MathLive.
 *
 * MathLive ne s'auto-enregistre pas comme élément personnalisé en
 * environnement jsdom (vérifié empiriquement : `customElements.get('math-field')`
 * reste `undefined` après `import 'mathlive'`, contrairement à un vrai
 * navigateur) — c'est exactement le cas « MathLive échoue à charger » que le
 * composant doit couvrir par un repli. On exploite ce comportement réel de
 * jsdom pour tester le repli sans avoir à le simuler artificiellement, et on
 * simule l'inverse (`customElements.get` stubé) pour couvrir le cas nominal.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MemoFormulaInput } from '../../../src/components/pedagogical-log/MemoFormulaInput'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('MemoFormulaInput — repli si MathLive est indisponible', () => {
  it('affiche un repli textarea après le délai d\'attente, jsdom ne fournissant pas <math-field>', async () => {
    vi.useFakeTimers()
    const handleChange = vi.fn()

    render(<MemoFormulaInput id="formula" value="" onChange={handleChange} />)

    expect(screen.getByText(/chargement de l'éditeur de formule/i)).toBeDefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })

    expect(screen.getByText(/n'a pas pu se charger/i)).toBeDefined()
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('le repli textarea remonte la saisie via onChange', async () => {
    vi.useFakeTimers()
    const handleChange = vi.fn()

    render(<MemoFormulaInput id="formula" value="" onChange={handleChange} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })

    vi.useRealTimers()
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'x^2')

    expect(handleChange).toHaveBeenCalled()
  })
})

describe('MemoFormulaInput — MathLive disponible', () => {
  it('rend le champ <math-field> quand le web component est enregistré', async () => {
    vi.spyOn(customElements, 'get').mockReturnValue(function FakeMathfieldElement() {} as unknown as CustomElementConstructor)

    const { container } = render(<MemoFormulaInput id="formula" value="x^2" onChange={vi.fn()} />)

    await waitFor(() => {
      expect(container.querySelector('math-field')).not.toBeNull()
    })
    expect(screen.queryByText(/n'a pas pu se charger/i)).toBeNull()
  })
})
