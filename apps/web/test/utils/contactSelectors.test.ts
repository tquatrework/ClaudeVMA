/**
 * Sélections sur `GET /relations/my-contacts` — la source qui remplace les champs
 * « UUID de l'élève » et « UUID du formateur » des anciens formulaires.
 */

import { describe, it, expect } from 'vitest'
import {
  selectAnimatedTeachers,
  selectFinancedStudents,
  selectMyStudents,
  selectMyTeachers,
  selectTeachersOfStudent,
} from '../../src/utils/contactSelectors'
import type { ContactOption } from '../../src/hooks/relations/useMyContacts'

const LEA: ContactOption = {
  userId: 'student-lea',
  firstName: 'Lea',
  lastName: 'Bertrand',
  displayName: 'Lea Bertrand',
  relations: [{ kind: 'finance_owner_of_student' }],
}

const THEO: ContactOption = {
  userId: 'student-theo',
  firstName: 'Théo',
  lastName: 'Relation',
  displayName: 'Théo Relation',
  relations: [{ kind: 'finance_owner_of_student' }],
}

const NADIA: ContactOption = {
  userId: 'teacher-nadia',
  firstName: 'Nadia',
  lastName: 'Lambert',
  displayName: 'Nadia Lambert',
  relations: [
    { kind: 'finance_owner_of_student_of_teacher', throughUserIds: ['student-lea'] },
  ],
}

const YANIS: ContactOption = {
  userId: 'teacher-yanis',
  firstName: 'Yanis',
  lastName: 'Roche',
  displayName: 'Yanis Roche',
  relations: [
    { kind: 'finance_owner_of_student_of_teacher', throughUserIds: ['student-theo'] },
  ],
}

const ALL_CONTACTS = [LEA, THEO, NADIA, YANIS]

describe('selectFinancedStudents', () => {
  it('ne retient que les élèves financés, pas leurs professeurs', () => {
    expect(selectFinancedStudents(ALL_CONTACTS).map((contact) => contact.userId)).toEqual([
      'student-lea',
      'student-theo',
    ])
  })

  it('renvoie une liste vide quand aucun élève n’est rattaché', () => {
    expect(selectFinancedStudents([NADIA])).toEqual([])
  })
})

describe('selectTeachersOfStudent', () => {
  it('suit le lien indirect via `throughUserIds`', () => {
    expect(
      selectTeachersOfStudent(ALL_CONTACTS, 'student-lea').map((contact) => contact.userId),
    ).toEqual(['teacher-nadia'])
  })

  it("ne mélange pas les professeurs de deux élèves différents", () => {
    expect(
      selectTeachersOfStudent(ALL_CONTACTS, 'student-theo').map((contact) => contact.userId),
    ).toEqual(['teacher-yanis'])
  })

  it('renvoie une liste vide pour un élève sans professeur', () => {
    expect(selectTeachersOfStudent(ALL_CONTACTS, 'student-inconnu')).toEqual([])
  })
})

// ─── Destinataires de ProposeCourseSlotDialog (chantier calendrier, point 3) ──────

const ELEVE_DE_FORMATEUR: ContactOption = {
  userId: 'student-clara',
  firstName: 'Clara',
  lastName: 'Petit',
  displayName: 'Clara Petit',
  relations: [{ kind: 'teacher_of_student' }],
}

const FORMATEUR_ANIME: ContactOption = {
  userId: 'teacher-hugo',
  firstName: 'Hugo',
  lastName: 'Vidal',
  displayName: 'Hugo Vidal',
  relations: [{ kind: 'animator_of_teacher' }],
}

describe('selectMyStudents', () => {
  it('ne retient que les élèves du formateur', () => {
    expect(
      selectMyStudents([ELEVE_DE_FORMATEUR, FORMATEUR_ANIME, LEA]).map(
        (contact) => contact.userId,
      ),
    ).toEqual(['student-clara'])
  })

  it('renvoie une liste vide sans élève', () => {
    expect(selectMyStudents([LEA, NADIA])).toEqual([])
  })
})

describe('selectAnimatedTeachers', () => {
  it("ne retient que les formateurs animés par l'AP", () => {
    expect(
      selectAnimatedTeachers([ELEVE_DE_FORMATEUR, FORMATEUR_ANIME, NADIA]).map(
        (contact) => contact.userId,
      ),
    ).toEqual(['teacher-hugo'])
  })

  it('renvoie une liste vide sans formateur animé', () => {
    expect(selectAnimatedTeachers([LEA, NADIA])).toEqual([])
  })
})

// ─── Destinataires de EventCreateFormModal côté élève (correction du 2026-08-20, point D) ──

const MON_FORMATEUR: ContactOption = {
  userId: 'teacher-sonia',
  firstName: 'Sonia',
  lastName: 'Lefevre',
  displayName: 'Sonia Lefevre',
  relations: [{ kind: 'student_of_teacher' }],
}

describe('selectMyTeachers', () => {
  it("ne retient que les formateurs de l'élève", () => {
    expect(
      selectMyTeachers([MON_FORMATEUR, ELEVE_DE_FORMATEUR, FORMATEUR_ANIME]).map(
        (contact) => contact.userId,
      ),
    ).toEqual(['teacher-sonia'])
  })

  it('renvoie une liste vide sans formateur', () => {
    expect(selectMyTeachers([LEA, NADIA])).toEqual([])
  })
})
