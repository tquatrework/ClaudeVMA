/**
 * Formatage de l'annuaire des formateurs validés.
 *
 * Deux cas réels du serveur sont couverts ici parce qu'ils existent tous les deux
 * en base : `null` (profil pédagogique non renseigné — facultatif par arbitrage du
 * 2026-08-07) et `[]` (liste vide enregistrée). Aucun des deux ne doit produire le
 * mot « null » à l'écran, ni faire tomber l'affichage.
 */

import { describe, it, expect } from 'vitest'
import {
  formatTeacherExpertise,
  toSelectableTeacher,
} from '../../src/utils/teacherDirectory'
import type { ValidatedTeacher } from '../../src/types/profile'

function buildTeacher(overrides: Partial<ValidatedTeacher> = {}): ValidatedTeacher {
  return {
    userId: 'teacher-nadia',
    firstName: 'Nadia',
    lastName: 'Lambert',
    levels: ['seconde', 'premiere'],
    subjects: ['mathematiques'],
    ...overrides,
  }
}

describe('formatTeacherExpertise', () => {
  it('affiche niveaux et matières quand les deux sont renseignés', () => {
    expect(formatTeacherExpertise(['seconde', 'premiere'], ['mathematiques'])).toBe(
      'Niveaux : seconde, premiere · Matières : mathematiques',
    )
  })

  it("n'affiche que ce qui est renseigné", () => {
    expect(formatTeacherExpertise(['terminale'], null)).toBe('Niveaux : terminale')
    expect(formatTeacherExpertise(null, ['physique'])).toBe('Matières : physique')
  })

  it('renvoie null quand rien n’est renseigné', () => {
    expect(formatTeacherExpertise(null, null)).toBeNull()
  })

  it('traite une liste vide comme rien à afficher, sans écrire « null »', () => {
    expect(formatTeacherExpertise([], [])).toBeNull()
  })
})

describe('toSelectableTeacher', () => {
  it('construit un libellé humain à partir du prénom et du nom', () => {
    expect(toSelectableTeacher(buildTeacher()).displayName).toBe('Nadia Lambert')
  })

  it("conserve l'identifiant technique pour l'appel suivant", () => {
    expect(toSelectableTeacher(buildTeacher()).userId).toBe('teacher-nadia')
  })

  it("retombe sur un libellé français, jamais sur l'UUID, quand le nom manque", () => {
    const selectable = toSelectableTeacher(
      buildTeacher({ firstName: null, lastName: null }),
    )

    expect(selectable.displayName).toBe('Professeur (nom non renseigné)')
    expect(selectable.displayName).not.toContain('teacher-nadia')
  })

  it('accepte un prénom seul sans inventer le reste', () => {
    expect(
      toSelectableTeacher(buildTeacher({ lastName: null })).displayName,
    ).toBe('Nadia')
  })

  it('porte une expertise nulle quand le profil pédagogique est absent', () => {
    expect(
      toSelectableTeacher(buildTeacher({ levels: null, subjects: null })).expertise,
    ).toBeNull()
  })
})
