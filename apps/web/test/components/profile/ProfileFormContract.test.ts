/**
 * Les formulaires de profil proposent-ils **exactement** les champs du contrat
 * serveur, dans l'ordre du contrat ?
 *
 * Deux défauts symétriques, tous deux déjà survenus sur ce projet :
 *
 * - un champ du contrat **absent** du formulaire est invisible à l'écran, donc
 *   impossible à renseigner — c'est ce qui était arrivé à `passions` et
 *   `avatarUrl` (constat du 2026-08-09) ;
 * - un champ **resté** dans le formulaire après sa suppression côté serveur part
 *   à chaque enregistrement et fait échouer le `PUT` entier en `400` — risque
 *   couru le 2026-08-11 par `department` (administratif) et `context`
 *   (pédagogique élève), tous deux supprimés côté serveur.
 *
 * Vérifié contre la pile réelle le 2026-08-11 :
 * `PUT /profiles/:id/administrative {"department":"…"}` →
 * `400 {"message":["property department should not exist"]}` ;
 * `PUT /profiles/:id/pedagogical {"context":"…"}` →
 * `400 {"message":["property context should not exist"]}`.
 */

import { describe, it, expect } from 'vitest'
import { EDITABLE_FIELDS } from '../../../src/components/profile/AdministrativeProfileForm'
import {
  STUDENT_FORM_FIELDS,
  TEACHER_FORM_FIELDS,
} from '../../../src/components/profile/PedagogicalProfileForm'
import {
  ADMINISTRATIVE_FIELD_NAMES,
  STUDENT_DECLARATIVE_FIELD_NAMES,
  TEACHER_DECLARATIVE_FIELD_NAMES,
} from '../../../src/utils/profileFields'
import { PROFILE_FIELD_LABELS } from '../../../src/utils/profileFieldLabels'

const administrativeFormFieldNames = EDITABLE_FIELDS.map((field) => field.name)
const studentFormFieldNames = STUDENT_FORM_FIELDS.map((field) => field.name)
const teacherFormFieldNames = TEACHER_FORM_FIELDS.map((field) => field.name)

describe('formulaire administratif', () => {
  it('propose exactement les champs du contrat, dans son ordre', () => {
    expect(administrativeFormFieldNames).toEqual([...ADMINISTRATIVE_FIELD_NAMES])
  })

  it('ne propose plus « Département », supprimé côté serveur', () => {
    expect(administrativeFormFieldNames).not.toContain('department')
  })

  it("ne propose pas l'e-mail en saisie : aucune route ne le modifie", () => {
    // `PUT /accounts/:accountId` → 404, `PUT /profiles/:id/administrative`
    // → 400 sur `email`. Un champ de saisie jetterait ce que l'utilisateur tape.
    expect(administrativeFormFieldNames).not.toContain('email')
  })
})

describe('formulaire pédagogique élève', () => {
  it('propose exactement les champs déclaratifs du contrat, dans son ordre', () => {
    expect(studentFormFieldNames).toEqual([...STUDENT_DECLARATIVE_FIELD_NAMES])
  })

  it('propose les quatre champs ajoutés le 2026-08-11', () => {
    expect(studentFormFieldNames).toContain('schoolName')
    expect(studentFormFieldNames).toContain('familyContext')
    expect(studentFormFieldNames).toContain('schoolContext')
    expect(studentFormFieldNames).toContain('equipment')
  })

  it("ne propose plus l'ancien champ unique `context`", () => {
    expect(studentFormFieldNames).not.toContain('context')
  })

  it('sépare bien les deux contextes en deux champs distincts', () => {
    const contextFieldNames = studentFormFieldNames.filter((fieldName) =>
      fieldName.toLowerCase().includes('context'),
    )
    expect(contextFieldNames).toEqual(['familyContext', 'schoolContext'])
  })

  it('garde `equipment` en un seul champ libre', () => {
    // La parenthèse du libellé décrit le contenu attendu ; elle n'annonce pas
    // une décomposition en « lieu » + « équipement ».
    expect(studentFormFieldNames.filter((fieldName) => fieldName === 'equipment')).toHaveLength(1)
    expect(PROFILE_FIELD_LABELS.equipment).toBe('Matériel (lieu des cours, équipement)')
  })

  it('affiche chaque champ sous un libellé français explicite', () => {
    for (const fieldName of studentFormFieldNames) {
      expect(PROFILE_FIELD_LABELS[fieldName]).toBeDefined()
    }
    expect(PROFILE_FIELD_LABELS.schoolName).toBe('Établissement')
    expect(PROFILE_FIELD_LABELS.familyContext).toBe('Contexte familial')
    expect(PROFILE_FIELD_LABELS.schoolContext).toBe('Contexte scolaire')
  })
})

describe('formulaire pédagogique formateur', () => {
  it('propose exactement les champs déclaratifs du contrat, dans son ordre', () => {
    expect(teacherFormFieldNames).toEqual([...TEACHER_DECLARATIVE_FIELD_NAMES])
  })

  it("n'emprunte aucun champ au profil élève", () => {
    // Les deux formes ont des routes communes mais des colonnes distinctes :
    // un champ élève adressé à un profil formateur est refusé en `400`.
    for (const studentOnlyFieldName of [
      'schoolName',
      'familyContext',
      'schoolContext',
      'equipment',
    ]) {
      expect(teacherFormFieldNames).not.toContain(studentOnlyFieldName)
    }
  })
})
