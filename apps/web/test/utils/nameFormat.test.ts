/**
 * Tests pour formatPersonDisplayName / formatPersonName (src/utils/nameFormat.ts)
 *
 * Règle produit vérifiée ici (consigne UX VisioMath) : un identifiant technique
 * (UUID) n'est JAMAIS un libellé à l'écran. La signature de la fonction ne reçoit
 * donc plus d'`userId` du tout — c'est la garantie structurelle qu'aucun appelant
 * ne peut en réintroduire un.
 *
 * Couvre :
 * - Nom + prénom présents → nom complet, avec l'identifiant de connexion en repère
 * - Nom + prénom présents sans identifiant de connexion → nom complet seul
 * - Nom/prénom absents → libellé générique + identifiant de connexion
 * - Rien de disponible → repli explicite « nom non renseigné »
 * - Prénom seul / nom seul
 * - formatPersonName sur la forme `{firstName, lastName}` des routes de relations
 */

import { describe, it, expect } from 'vitest'
import { formatPersonDisplayName, formatPersonName } from '../../src/utils/nameFormat'
import { UUID_PATTERN } from '../../src/test-helpers'

const SAMPLE_UUID = 'ee7c85dc-1234-4abc-9def-000000000000'

describe('formatPersonDisplayName', () => {
  it("affiche le nom complet suivi de l'identifiant de connexion quand les deux sont disponibles", () => {
    const result = formatPersonDisplayName('Jean', 'Dupont', 'jdupont', 'Financeur')
    expect(result).toBe('Jean Dupont (jdupont)')
  })

  it("affiche uniquement le nom complet si aucun identifiant de connexion n'est disponible", () => {
    expect(formatPersonDisplayName('Jean', 'Dupont', null, 'Financeur')).toBe('Jean Dupont')
    expect(formatPersonDisplayName('Jean', 'Dupont', undefined, 'Financeur')).toBe('Jean Dupont')
  })

  it('gère un prénom seul (sans nom de famille)', () => {
    expect(formatPersonDisplayName('Jean', undefined, 'jdupont', 'Financeur')).toBe('Jean (jdupont)')
  })

  it('gère un nom de famille seul (sans prénom)', () => {
    expect(formatPersonDisplayName(undefined, 'Dupont', 'jdupont', 'Financeur')).toBe(
      'Dupont (jdupont)',
    )
  })

  it('traite null comme une absence de valeur au même titre que undefined', () => {
    expect(formatPersonDisplayName(null, null, 'jdupont', 'Financeur')).toBe('Financeur (jdupont)')
  })

  it("quand prénom/nom sont absents, affiche le libellé générique avec l'identifiant de connexion", () => {
    expect(formatPersonDisplayName(undefined, undefined, 'jdupont', 'Financeur')).toBe(
      'Financeur (jdupont)',
    )
  })

  it("affiche un repli explicite et lisible quand rien n'est disponible", () => {
    expect(formatPersonDisplayName(undefined, undefined, undefined, 'Financeur')).toBe(
      'Financeur (nom non renseigné)',
    )
    expect(formatPersonDisplayName(undefined, undefined, null, 'Élève')).toBe(
      'Élève (nom non renseigné)',
    )
  })

  it("n'expose jamais un UUID, même si on tente de le passer comme identifiant de connexion", () => {
    // Régression du 2026-08-08 : le libellé contenait auparavant « (ID : <uuid> ) ».
    // Un UUID passé en loginIdentifier resterait un cas d'appel fautif, mais la
    // signature n'accepte plus d'`userId` — le chemin d'origine du bug est fermé.
    const result = formatPersonDisplayName('Jean', 'Dupont', null, 'Financeur')
    expect(result).not.toMatch(UUID_PATTERN)
    expect(result).not.toContain(SAMPLE_UUID)
  })
})

describe('formatPersonName', () => {
  it('affiche prénom + nom depuis la forme {firstName, lastName} des routes de relations', () => {
    expect(formatPersonName({ firstName: 'Jean', lastName: 'Martin' }, 'Financeur')).toBe(
      'Jean Martin',
    )
  })

  it('affiche un repli lisible quand le nom est null (profil administratif absent)', () => {
    expect(formatPersonName(null, 'Financeur')).toBe('Financeur (nom non renseigné)')
    expect(formatPersonName(undefined, 'Élève')).toBe('Élève (nom non renseigné)')
  })

  it('affiche un repli lisible quand firstName et lastName sont null individuellement', () => {
    expect(formatPersonName({ firstName: null, lastName: null }, 'Financeur')).toBe(
      'Financeur (nom non renseigné)',
    )
  })

  it('gère un nom partiel (prénom renseigné, nom absent)', () => {
    expect(formatPersonName({ firstName: 'Jean', lastName: null }, 'Financeur')).toBe('Jean')
  })

  it('ne produit jamais un libellé contenant un UUID', () => {
    expect(formatPersonName(null, 'Financeur')).not.toMatch(UUID_PATTERN)
  })
})
