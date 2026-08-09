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
 * Les deux sont **listés** : un champ escamoté parce qu'il est vide est un champ
 * que le titulaire ne sait pas qu'il peut remplir (constat du 2026-08-09 — des
 * fiches réduites à « Prénom / Nom » sur des profils réels où tout est vide).
 * La différence entre les deux états est portée par la **mention** affichée, pas
 * par la présence de la ligne. Ces tests échouent si elles redeviennent
 * indiscernables.
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
    expect(screen.queryByText('Non renseigné')).toBeNull()
  })
})

describe('ProfileFieldList — champ non renseigné', () => {
  it('liste un champ présent valant `null`, avec la mention « Non renseigné »', () => {
    render(<ProfileFieldList data={{ phone: null, difficulties: '' }} />)

    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getByText('Difficultés rencontrées')).toBeDefined()
    expect(screen.getAllByText('Non renseigné')).toHaveLength(2)
  })

  it('ne présente jamais un champ vide comme non partagé', () => {
    render(<ProfileFieldList data={{ phone: null }} />)

    expect(screen.queryByText('Non partagé')).toBeNull()
  })

  it('liste les champs attendus même quand le bloc reçu est entièrement vide', () => {
    // Cas réel du 2026-08-09 : un profil dont seuls le prénom et le nom sont
    // remplis. Les dix autres champs doivent rester visibles.
    render(<ProfileFieldList data={{}} fieldNames={['phone', 'city', 'country']} />)

    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getByText('Ville')).toBeDefined()
    expect(screen.getByText('Pays')).toBeDefined()
    expect(screen.getAllByText('Non renseigné')).toHaveLength(3)
  })

  it('respecte l’ordre du contrat, pas celui des clés reçues', () => {
    render(
      <ProfileFieldList
        data={{ city: 'Paris', firstName: 'Alice' }}
        fieldNames={['firstName', 'city']}
      />,
    )

    const labels = screen.getAllByRole('term').map((node) => node.textContent)
    expect(labels).toEqual(['Prénom', 'Ville'])
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
    // `difficulties` : présent à `null` → « Non renseigné ».
    // `phone` : absent + nommé masqué → « Non partagé ».
    // Les deux lignes existent ; seule la mention les distingue.
    render(
      <ProfileFieldList
        data={{ firstName: 'Alice', difficulties: null }}
        fieldNames={['firstName', 'difficulties', 'phone']}
        hiddenFieldNames={['phone']}
      />,
    )

    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Difficultés rencontrées')).toBeDefined()
    expect(screen.getAllByText('Non renseigné')).toHaveLength(1)
    expect(screen.getByText('Téléphone')).toBeDefined()
    expect(screen.getAllByText('Non partagé')).toHaveLength(1)
  })
})

describe('hasProfileFieldRows', () => {
  it('est faux pour un bloc entièrement vide dont on n’attend aucun champ précis', () => {
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

  it('est vrai dès qu’une liste de champs est attendue, même sans aucune valeur', () => {
    // C'est la liste des champs du contrat qui dit au titulaire ce qu'il peut
    // renseigner : la remplacer par « aucune donnée » le laisserait sans prise.
    expect(hasProfileFieldRows({}, [], ['phone', 'city'])).toBe(true)
  })
})
