/**
 * Tests pour formatPersonDisplayName (src/utils/nameFormat.ts)
 *
 * Couvre :
 * - Nom + prénom présents → nom complet + identifiant entre parenthèses
 * - Nom + prénom présents sans aucun identifiant → nom complet seul
 * - Nom/prénom absents, identifiant de connexion présent → libellé générique + identifiant
 * - Nom/prénom et identifiant de connexion absents, identifiant technique présent →
 *   libellé générique + identifiant technique (jamais tronqué, jamais masqué)
 * - Rien de disponible → libellé générique "inconnu"
 * - Seul le prénom, ou seul le nom, est disponible
 */

import { describe, it, expect } from 'vitest'
import { formatPersonDisplayName } from '../../src/utils/nameFormat'

describe('formatPersonDisplayName', () => {
  it('affiche le nom complet suivi de l\'identifiant de connexion quand tout est disponible', () => {
    const result = formatPersonDisplayName(
      'Jean',
      'Dupont',
      'jdupont',
      'ee7c85dc-1234-4abc-9def-000000000000',
      'Financeur',
    )
    expect(result).toBe('Jean Dupont (ID : jdupont)')
  })

  it("affiche le nom complet suivi de l'identifiant technique si aucun identifiant de connexion n'est disponible", () => {
    const result = formatPersonDisplayName(
      'Jean',
      'Dupont',
      null,
      'ee7c85dc-1234-4abc-9def-000000000000',
      'Financeur',
    )
    expect(result).toBe('Jean Dupont (ID : ee7c85dc-1234-4abc-9def-000000000000)')
  })

  it('affiche uniquement le nom complet si aucun identifiant n\'est disponible', () => {
    const result = formatPersonDisplayName('Jean', 'Dupont', null, undefined, 'Financeur')
    expect(result).toBe('Jean Dupont')
  })

  it('gère un prénom seul (sans nom de famille)', () => {
    const result = formatPersonDisplayName('Jean', undefined, 'jdupont', 'ee7c85dc', 'Financeur')
    expect(result).toBe('Jean (ID : jdupont)')
  })

  it('gère un nom de famille seul (sans prénom)', () => {
    const result = formatPersonDisplayName(undefined, 'Dupont', 'jdupont', 'ee7c85dc', 'Financeur')
    expect(result).toBe('Dupont (ID : jdupont)')
  })

  it(
    'quand prénom/nom sont absents, affiche le libellé générique avec l\'identifiant de connexion ' +
      '— jamais un extrait d\'UUID nu',
    () => {
      const result = formatPersonDisplayName(
        undefined,
        undefined,
        'jdupont',
        'ee7c85dc-1234-4abc-9def-000000000000',
        'Financeur',
      )
      expect(result).toBe('Financeur (ID : jdupont)')
    },
  )

  it(
    'quand prénom, nom ET identifiant de connexion sont absents, affiche le libellé générique ' +
      'avec l\'identifiant technique complet (jamais masqué ni tronqué)',
    () => {
      const result = formatPersonDisplayName(
        undefined,
        undefined,
        null,
        'ee7c85dc-1234-4abc-9def-000000000000',
        'Financeur',
      )
      expect(result).toBe('Financeur (ID : ee7c85dc-1234-4abc-9def-000000000000)')
      // L'identifiant ne doit jamais être tronqué avec une ellipse
      expect(result).not.toContain('…')
    },
  )

  it("affiche un état générique explicite quand rien n'est disponible", () => {
    const result = formatPersonDisplayName(undefined, undefined, undefined, undefined, 'Élève')
    expect(result).toBe('Élève inconnu')
  })

  it('utilise le libellé générique fourni (Élève) pour le repli sans nom', () => {
    const result = formatPersonDisplayName(undefined, undefined, undefined, 'student-42', 'Élève')
    expect(result).toBe('Élève (ID : student-42)')
  })
})
