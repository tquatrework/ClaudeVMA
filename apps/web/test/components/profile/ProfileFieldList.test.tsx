/**
 * Tests de `ProfileFieldList` — le rendu qui porte, à lui seul, la distinction
 * entre « non renseigné » et « non partagé ».
 *
 * Rappel du contrat serveur (`docs/routes.md` § « Application en lecture ») :
 *
 * | Observation                               | Signification            |
 * |-------------------------------------------|--------------------------|
 * | clé **présente** valant `null`             | champ **non renseigné**  |
 * | clé **absente** + nom dans `hiddenFields`  | champ **non partagé**    |
 *
 * À l'écran, la différence est la **présence de la ligne** : un champ vide n'est
 * pas listé, un champ non partagé l'est avec sa pastille. Ces tests échouent si
 * les deux états redeviennent indiscernables.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  ProfileFieldList,
  hasProfileFieldRows,
} from '../../../src/components/profile/ProfileFieldList'

describe('ProfileFieldList — champ renseigné', () => {
  it('affiche le libellé français et la valeur', () => {
    render(<ProfileFieldList data={{ phone: '0612345678' }} />)

    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getByText('0612345678')).toBeDefined()
    expect(screen.queryByText('Non partagé')).toBeNull()
  })
})

describe('ProfileFieldList — champ non renseigné', () => {
  it('ne liste pas un champ présent valant `null`', () => {
    // `null` = renseigné par personne. Une fiche n'énumère pas ce qui est vide.
    render(<ProfileFieldList data={{ phone: null, difficulties: '' }} />)

    expect(screen.queryByText('Téléphone')).toBeNull()
    expect(screen.queryByText('Difficultés rencontrées')).toBeNull()
  })

  it('ne présente jamais un champ vide comme non partagé', () => {
    render(<ProfileFieldList data={{ phone: null }} />)

    expect(screen.queryByText('Non partagé')).toBeNull()
  })
})

describe('ProfileFieldList — champ non partagé', () => {
  it('liste le champ absent du bloc, avec la mention « Non partagé »', () => {
    // Le champ est ABSENT de `data` (le serveur l'a retiré) : son nom ne peut
    // venir que de `hiddenFields`.
    render(<ProfileFieldList data={{ firstName: 'Alice' }} hiddenFieldNames={['phone']} />)

    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getByText('Non partagé')).toBeDefined()
  })

  it("n'invente aucune valeur pour un champ non partagé", () => {
    render(<ProfileFieldList data={{}} hiddenFieldNames={['difficulties']} />)

    expect(screen.getByText('Difficultés rencontrées')).toBeDefined()
    expect(screen.queryByText('Non renseigné')).toBeNull()
  })
})

describe('ProfileFieldList — les deux états côte à côte', () => {
  it('rend « non renseigné » et « non partagé » différemment', () => {
    // `difficulties` : présent à `null` → non renseigné, donc pas de ligne.
    // `phone` : absent + nommé masqué → une ligne portant « Non partagé ».
    render(
      <ProfileFieldList
        data={{ firstName: 'Alice', difficulties: null }}
        hiddenFieldNames={['phone']}
      />,
    )

    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.queryByText('Difficultés rencontrées')).toBeNull()
    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getAllByText('Non partagé')).toHaveLength(1)
  })
})

describe('hasProfileFieldRows', () => {
  it('est faux pour un bloc entièrement vide', () => {
    expect(hasProfileFieldRows({ phone: null, city: '' }, [])).toBe(false)
    expect(hasProfileFieldRows(undefined, [])).toBe(false)
  })

  it('est vrai dès qu’un champ est non partagé, même sans aucune valeur', () => {
    // Sans cela, une section entièrement masquée afficherait « aucune donnée » —
    // c'est-à-dire un mensonge.
    expect(hasProfileFieldRows({}, ['phone'])).toBe(true)
  })

  it('est vrai dès qu’une valeur est renseignée', () => {
    expect(hasProfileFieldRows({ phone: '0612345678' }, [])).toBe(true)
  })
})
