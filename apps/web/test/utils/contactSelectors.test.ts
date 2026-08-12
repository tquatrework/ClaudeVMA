/**
 * Sélections sur `GET /relations/my-contacts` — la source qui remplace les champs
 * « UUID de l'élève » et « UUID du formateur » des anciens formulaires.
 */

import { describe, it, expect } from 'vitest'
import {
  selectFinancedStudents,
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
