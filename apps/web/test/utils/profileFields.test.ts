/**
 * Tests de la frontière API des profils (`src/utils/profileFields.ts`).
 *
 * Les listes de champs sont le miroir de `docs/routes.md` § « Noms de champs des
 * profils ». Elles sont assertées ici en égalité stricte : ajouter, retirer ou
 * renommer un champ sans mettre à jour la documentation (et réciproquement) fait
 * échouer ces tests, plutôt que de se découvrir en 400 à l'exécution.
 */

import { describe, it, expect } from 'vitest'
import {
  ADMINISTRATIVE_FIELD_NAMES,
  STUDENT_PEDAGOGICAL_FIELD_NAMES,
  TEACHER_PEDAGOGICAL_FIELD_NAMES,
  formatCommaSeparatedList,
  parseCommaSeparatedList,
  pedagogicalKindForRole,
  pickAdministrativeFields,
  resolvePedagogicalProfileKind,
} from '../../src/utils/profileFields'

describe('listes de champs de profil', () => {
  it('reprend exactement les champs administratifs documentés', () => {
    expect([...ADMINISTRATIVE_FIELD_NAMES]).toEqual([
      'firstName',
      'lastName',
      'birthDate',
      'phone',
      'addressLine1',
      'addressLine2',
      'postalCode',
      'city',
      'country',
      'avatarUrl',
      'department',
      'passions',
    ])
  })

  it("n'expose aucun champ `address` ni nom français côté administratif", () => {
    expect(ADMINISTRATIVE_FIELD_NAMES).not.toContain('address')
    expect(ADMINISTRATIVE_FIELD_NAMES).not.toContain('adresse')
    expect(ADMINISTRATIVE_FIELD_NAMES).not.toContain('adresseLigne1')
    expect(ADMINISTRATIVE_FIELD_NAMES).not.toContain('telephone')
  })

  it('reprend exactement les champs pédagogiques élève documentés', () => {
    expect([...STUDENT_PEDAGOGICAL_FIELD_NAMES]).toEqual([
      'level',
      'goals',
      'specificNeeds',
      'subjects',
    ])
    // `notes` n'existe pas côté serveur : le besoin correspondant est `specificNeeds`.
    expect(STUDENT_PEDAGOGICAL_FIELD_NAMES).not.toContain('notes')
    expect(STUDENT_PEDAGOGICAL_FIELD_NAMES).not.toContain('niveauScolaire')
    expect(STUDENT_PEDAGOGICAL_FIELD_NAMES).not.toContain('matieres')
  })

  it('reprend exactement les champs pédagogiques formateur documentés', () => {
    expect([...TEACHER_PEDAGOGICAL_FIELD_NAMES]).toEqual([
      'levels',
      'experience',
      'testResults',
      'subjects',
      'isAnimateurPedagogique',
    ])
    // `level` au singulier appartient au profil élève et discriminerait vers lui.
    expect(TEACHER_PEDAGOGICAL_FIELD_NAMES).not.toContain('level')
  })
})

describe('parseCommaSeparatedList', () => {
  it('découpe et nettoie une saisie utilisateur', () => {
    expect(parseCommaSeparatedList('Algèbre,  Géométrie ')).toEqual(['Algèbre', 'Géométrie'])
  })

  it('ne produit jamais de valeur vide', () => {
    expect(parseCommaSeparatedList('')).toEqual([])
    expect(parseCommaSeparatedList(' , , ')).toEqual([])
    expect(parseCommaSeparatedList('Maths,')).toEqual(['Maths'])
  })
})

describe('formatCommaSeparatedList', () => {
  it('rassemble un tableau en saisie lisible', () => {
    expect(formatCommaSeparatedList(['Maths', 'Physique'])).toBe('Maths, Physique')
  })

  it('tolère une valeur absente ou déjà textuelle sans jamais afficher de JSON', () => {
    expect(formatCommaSeparatedList(undefined)).toBe('')
    expect(formatCommaSeparatedList(null)).toBe('')
    expect(formatCommaSeparatedList('Maths')).toBe('Maths')
    expect(formatCommaSeparatedList({ a: 1 })).toBe('')
  })
})

describe('pickAdministrativeFields', () => {
  it('ne conserve que les champs réacceptés en écriture', () => {
    expect(
      pickAdministrativeFields({
        firstName: 'Alice',
        addressLine1: '1 rue de la Paix',
        // Champs hors contrat : le serveur répondrait 400 s'ils repartaient.
        address: '1 rue de la Paix',
        telephone: '0601020304',
        updatedAt: '2026-08-07T10:00:00.000Z',
      }),
    ).toEqual({ firstName: 'Alice', addressLine1: '1 rue de la Paix' })
  })

  it('renvoie un objet vide pour un bloc absent', () => {
    expect(pickAdministrativeFields(null)).toEqual({})
    expect(pickAdministrativeFields(undefined)).toEqual({})
  })
})

describe('resolvePedagogicalProfileKind', () => {
  it("s'appuie d'abord sur les données déjà enregistrées", () => {
    expect(resolvePedagogicalProfileKind({ level: 'Terminale' }, 'formateur')).toBe('student')
    expect(resolvePedagogicalProfileKind({ experience: '8 ans' }, 'eleve')).toBe('teacher')
    expect(resolvePedagogicalProfileKind({ levels: ['Seconde'] }, undefined)).toBe('teacher')
  })

  it('ne tranche pas sur `subjects`, présent sur les deux profils', () => {
    expect(resolvePedagogicalProfileKind({ subjects: ['Maths'] }, undefined)).toBe('unknown')
  })

  it('retombe sur le rôle quand le profil est vierge', () => {
    expect(resolvePedagogicalProfileKind(null, 'eleve')).toBe('student')
    expect(resolvePedagogicalProfileKind(null, 'formateur')).toBe('teacher')
    expect(resolvePedagogicalProfileKind(null, 'animateur_pedagogique')).toBe('teacher')
  })

  it('reste indéterminé sans donnée ni rôle exploitable', () => {
    expect(resolvePedagogicalProfileKind(null, undefined)).toBe('unknown')
    expect(resolvePedagogicalProfileKind(null, 'responsable_pedagogique')).toBe('unknown')
  })
})

describe('pedagogicalKindForRole', () => {
  it('associe chaque rôle à la forme de profil correspondante', () => {
    expect(pedagogicalKindForRole('eleve')).toBe('student')
    expect(pedagogicalKindForRole('formateur')).toBe('teacher')
    expect(pedagogicalKindForRole('parent_financeur')).toBe('unknown')
  })
})
