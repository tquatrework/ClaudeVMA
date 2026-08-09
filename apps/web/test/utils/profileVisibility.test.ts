/**
 * Tests du point unique de lecture du bloc `visibility`
 * (`src/utils/profileVisibility.ts`).
 *
 * Ce que ces tests protègent : la **distinction** entre un champ non renseigné
 * et un champ non partagé. Le serveur ne remplace jamais un champ masqué par
 * `null` — il le retire du bloc et le nomme dans `hiddenFields`. Un front qui
 * confondrait les deux ferait croire à un formateur que l'élève n'a rien saisi
 * alors qu'il a seulement choisi de ne pas partager.
 *
 * Contrat : `docs/routes.md` § « Application en lecture (2026-08-09) ».
 */

import { describe, it, expect } from 'vitest'
import type { ProfileVisibility } from '../../src/types/profile'
import {
  FILTERED_PROFILE_DESCRIPTION,
  FILTERED_PROFILE_TITLE,
  NOT_SHARED_PLACEHOLDER,
  PRESCRIPTION_NOT_SHARED_MESSAGE,
  isFieldHidden,
  isProfileFiltered,
  pickHiddenFieldNames,
} from '../../src/utils/profileVisibility'

const FILTERED: ProfileVisibility = {
  isFiltered: true,
  hiddenFields: ['phone', 'difficulties', 'addressLine1'],
}

const UNFILTERED: ProfileVisibility = { isFiltered: false, hiddenFields: [] }

describe('isProfileFiltered', () => {
  it('reconnaît une lecture filtrée', () => {
    expect(isProfileFiltered(FILTERED)).toBe(true)
  })

  it('reconnaît une fiche entière (titulaire, parent financeur, administrateurs)', () => {
    expect(isProfileFiltered(UNFILTERED)).toBe(false)
  })

  it('distingue « fiche entière » de « lecteur filtré sans champ masqué »', () => {
    // `isFiltered: true` avec une liste vide n'est PAS la même information qu'une
    // fiche renvoyée en entier : le premier lecteur subit les réglages, il se
    // trouve seulement qu'aucun ne le prive de quoi que ce soit.
    const filteredButNothingHidden: ProfileVisibility = { isFiltered: true, hiddenFields: [] }

    expect(isProfileFiltered(filteredButNothingHidden)).toBe(true)
    expect(isProfileFiltered(UNFILTERED)).toBe(false)
  })

  it('traite une réponse sans bloc `visibility` comme non filtrée', () => {
    // Serveur antérieur au 2026-08-09 ou réponse tronquée : mieux vaut ne rien
    // annoncer qu'annoncer un filtrage inexistant.
    expect(isProfileFiltered(undefined)).toBe(false)
    expect(isProfileFiltered(null)).toBe(false)
  })
})

describe('isFieldHidden', () => {
  it('reconnaît un champ nommé dans hiddenFields', () => {
    expect(isFieldHidden('phone', FILTERED)).toBe(true)
  })

  it('ne masque pas un champ absent de hiddenFields', () => {
    // `firstName` fait partie du socle partagé par défaut.
    expect(isFieldHidden('firstName', FILTERED)).toBe(false)
  })

  it('ne masque rien sans bloc `visibility`', () => {
    expect(isFieldHidden('phone', undefined)).toBe(false)
  })

  it('ne masque rien quand hiddenFields est absent de la réponse', () => {
    expect(isFieldHidden('phone', { isFiltered: true } as unknown as ProfileVisibility)).toBe(false)
  })
})

describe('pickHiddenFieldNames', () => {
  it('ne retient que les champs masqués de la section demandée', () => {
    // `difficulties` est pédagogique : il n'a rien à faire sous les informations
    // administratives, sans quoi la fiche annoncerait un champ masqué au mauvais
    // endroit.
    const administrativeNames = ['firstName', 'lastName', 'phone', 'addressLine1']

    expect(pickHiddenFieldNames(administrativeNames, FILTERED)).toEqual([
      'phone',
      'addressLine1',
    ])
  })

  it("respecte l'ordre d'affichage de la section, pas celui du serveur", () => {
    // `hiddenFields` arrive dans l'ordre du serveur ; l'écran garde le sien.
    expect(pickHiddenFieldNames(['addressLine1', 'phone'], FILTERED)).toEqual([
      'addressLine1',
      'phone',
    ])
  })

  it('rend une liste vide pour une fiche entière', () => {
    expect(pickHiddenFieldNames(['phone', 'firstName'], UNFILTERED)).toEqual([])
  })

  it('rend une liste vide sans bloc `visibility`', () => {
    expect(pickHiddenFieldNames(['phone'], undefined)).toEqual([])
  })

  it('ignore un champ masqué qui ne fait pas partie des champs affichés', () => {
    const visibility: ProfileVisibility = { isFiltered: true, hiddenFields: ['champInconnu'] }

    expect(pickHiddenFieldNames(['phone', 'firstName'], visibility)).toEqual([])
  })
})

describe('libellés affichés — français et non culpabilisants', () => {
  it('emploie « Non partagé », qui ne dit rien du contenu du champ', () => {
    // Le serveur filtre sur le réglage, pas sur la valeur : le front ignore si le
    // champ a un contenu. « Masqué par l'élève » affirmerait ce qu'on ne sait
    // pas, et désignerait une personne là où il n'y a qu'un droit exercé.
    expect(NOT_SHARED_PLACEHOLDER).toBe('Non partagé')
    expect(NOT_SHARED_PLACEHOLDER).not.toMatch(/élève|formateur|refus/i)
  })

  it('ne confond pas la mention « Non partagé » avec « Non renseigné »', () => {
    expect(NOT_SHARED_PLACEHOLDER).not.toBe('Non renseigné')
  })

  it('explique le filtrage sans le présenter comme une erreur', () => {
    expect(FILTERED_PROFILE_TITLE).toContain('fiche partielle')
    expect(FILTERED_PROFILE_DESCRIPTION).toContain('choisit')
    expect(FILTERED_PROFILE_DESCRIPTION).toMatch(/ni un oubli/)
  })

  it('dit la vérité sur une prescription entièrement masquée', () => {
    expect(PRESCRIPTION_NOT_SHARED_MESSAGE).toMatch(/ne vous sont pas communiquées/)
  })
})
