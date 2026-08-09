/**
 * Tests de la frontière API des profils (`src/utils/profileFields.ts`).
 *
 * Les listes de champs sont le miroir de `docs/routes.md` § « Noms de champs des
 * profils ». Elles sont assertées ici en égalité stricte : ajouter, retirer ou
 * renommer un champ sans mettre à jour la documentation (et réciproquement) fait
 * échouer ces tests, plutôt que de se découvrir en 400 à l'exécution.
 *
 * Le profil pédagogique est renvoyé **à plat** par `GET /profiles/:userId`
 * (déclaratif et prescription confondus) mais s'écrit par **deux routes
 * distinctes** : `PUT .../pedagogical` (titulaire, déclaratif) et
 * `PUT .../prescription` (RP seul). C'est ce module qui porte la séparation ;
 * une fuite d'un champ d'une section vers l'autre produirait un `400`.
 */

import { describe, it, expect } from 'vitest'
import {
  ADMINISTRATIVE_FIELD_NAMES,
  LIST_FIELD_NAMES,
  PRESCRIPTION_AUTHORSHIP_FIELD_NAMES,
  STUDENT_DECLARATIVE_FIELD_NAMES,
  STUDENT_PRESCRIPTION_FIELD_NAMES,
  TEACHER_DECLARATIVE_FIELD_NAMES,
  TEACHER_PRESCRIPTION_FIELD_NAMES,
  TEACHER_READONLY_DISPLAY_FIELD_NAMES,
  declarativeFieldNames,
  formatCommaSeparatedList,
  hasPrescriptionContent,
  isListField,
  parseCommaSeparatedList,
  pedagogicalKindForRole,
  pickAdministrativeFields,
  pickDeclarativeDisplayFields,
  pickDeclarativeFields,
  pickPrescriptionFields,
  prescriptionFieldNames,
  resolvePedagogicalProfileKind,
} from '../../src/utils/profileFields'

/** Profil pédagogique élève tel que renvoyé par le serveur : à plat, mélangé. */
const FLAT_STUDENT_PEDAGOGICAL = {
  level: 'Terminale',
  subjects: ['Mathématiques'],
  goals: 'Préparer le bac',
  specificNeeds: 'Tiers-temps',
  difficulties: 'Les dérivées',
  context: 'Changement de lycée en cours d’année',
  generalAssessment: 'Élève sérieuse',
  recommendedPace: 'Deux séances par semaine',
  recommendedTeacherProfile: 'Formateur patient',
  recommendedPath: 'Remise à niveau puis bac',
  recommendedActivities: 'Exercices guidés',
  filledBy: 'rp-1',
  filledAt: '2026-08-09T10:00:00.000Z',
}

const FLAT_TEACHER_PEDAGOGICAL = {
  levels: ['Seconde', 'Terminale'],
  subjects: ['Mathématiques'],
  experience: '8 ans en lycée',
  diplomas: 'Agrégation de mathématiques',
  specialties: ['Préparation Grand Oral'],
  particularities: 'Cours en soirée',
  cvDocumentId: 'cv-2026-001',
  isAnimateurPedagogique: true,
  maxValidatedLevel: 'Terminale spécialité',
  audienceType: 'Collège et lycée',
  testResults: 'Test validé',
  testComments: 'Très bonne maîtrise',
  filledBy: 'rp-1',
  filledAt: '2026-08-09T10:00:00.000Z',
}

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

  it('reprend exactement la section déclarative élève documentée', () => {
    expect([...STUDENT_DECLARATIVE_FIELD_NAMES]).toEqual([
      'level',
      'subjects',
      'goals',
      'specificNeeds',
      'difficulties',
      'context',
    ])
    // `notes` n'existe pas côté serveur : le besoin correspondant est `specificNeeds`.
    expect(STUDENT_DECLARATIVE_FIELD_NAMES).not.toContain('notes')
    expect(STUDENT_DECLARATIVE_FIELD_NAMES).not.toContain('niveauScolaire')
    expect(STUDENT_DECLARATIVE_FIELD_NAMES).not.toContain('matieres')
  })

  it('reprend exactement la section déclarative formateur documentée', () => {
    expect([...TEACHER_DECLARATIVE_FIELD_NAMES]).toEqual([
      'levels',
      'subjects',
      'experience',
      'diplomas',
      'specialties',
      'particularities',
      'cvDocumentId',
    ])
    // `level` au singulier appartient au profil élève et discriminerait vers lui.
    expect(TEACHER_DECLARATIVE_FIELD_NAMES).not.toContain('level')
  })

  it('reprend exactement les sections de prescription documentées', () => {
    expect([...STUDENT_PRESCRIPTION_FIELD_NAMES]).toEqual([
      'generalAssessment',
      'recommendedPace',
      'recommendedTeacherProfile',
      'recommendedPath',
      'recommendedActivities',
    ])
    expect([...TEACHER_PRESCRIPTION_FIELD_NAMES]).toEqual([
      'maxValidatedLevel',
      'audienceType',
      'testResults',
      'testComments',
    ])
  })

  it('ne laisse aucun champ de prescription dans les sections déclaratives', () => {
    // `PUT /profiles/:userId/pedagogical` répond 400 sur un champ de prescription.
    for (const prescriptionFieldName of STUDENT_PRESCRIPTION_FIELD_NAMES) {
      expect(STUDENT_DECLARATIVE_FIELD_NAMES).not.toContain(prescriptionFieldName)
    }
    for (const prescriptionFieldName of TEACHER_PRESCRIPTION_FIELD_NAMES) {
      expect(TEACHER_DECLARATIVE_FIELD_NAMES).not.toContain(prescriptionFieldName)
    }
    // `testResults` a été déplacé en prescription : un formateur n'écrit pas ses
    // propres résultats de test.
    expect(TEACHER_DECLARATIVE_FIELD_NAMES).not.toContain('testResults')
    expect(TEACHER_PRESCRIPTION_FIELD_NAMES).toContain('testResults')
  })

  it("n'expose ni traçabilité ni droit AP en écriture déclarative", () => {
    expect([...PRESCRIPTION_AUTHORSHIP_FIELD_NAMES]).toEqual(['filledBy', 'filledAt'])
    for (const authorshipFieldName of PRESCRIPTION_AUTHORSHIP_FIELD_NAMES) {
      expect(STUDENT_DECLARATIVE_FIELD_NAMES).not.toContain(authorshipFieldName)
      expect(TEACHER_DECLARATIVE_FIELD_NAMES).not.toContain(authorshipFieldName)
      expect(STUDENT_PRESCRIPTION_FIELD_NAMES).not.toContain(authorshipFieldName)
      expect(TEACHER_PRESCRIPTION_FIELD_NAMES).not.toContain(authorshipFieldName)
    }
    // Droit attribué par POST /profiles/:teacherId/ap-status, jamais auto-déclaré.
    expect(TEACHER_DECLARATIVE_FIELD_NAMES).not.toContain('isAnimateurPedagogique')
    expect([...TEACHER_READONLY_DISPLAY_FIELD_NAMES]).toEqual(['isAnimateurPedagogique'])
  })

  it('déclare comme listes les seuls champs `string[]` de l’API', () => {
    expect([...LIST_FIELD_NAMES]).toEqual(['subjects', 'levels', 'specialties', 'passions'])
    expect(isListField('subjects')).toBe(true)
    expect(isListField('specialties')).toBe(true)
    expect(isListField('level')).toBe(false)
    expect(isListField('diplomas')).toBe(false)
  })
})

describe('declarativeFieldNames / prescriptionFieldNames', () => {
  it('sert le jeu de champs de la forme demandée', () => {
    expect(declarativeFieldNames('student')).toEqual([...STUDENT_DECLARATIVE_FIELD_NAMES])
    expect(declarativeFieldNames('teacher')).toEqual([...TEACHER_DECLARATIVE_FIELD_NAMES])
    expect(prescriptionFieldNames('student')).toEqual([...STUDENT_PRESCRIPTION_FIELD_NAMES])
    expect(prescriptionFieldNames('teacher')).toEqual([...TEACHER_PRESCRIPTION_FIELD_NAMES])
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

describe('pickDeclarativeFields', () => {
  it("n'extrait aucun champ de prescription du bloc à plat — élève", () => {
    expect(pickDeclarativeFields('student', FLAT_STUDENT_PEDAGOGICAL)).toEqual({
      level: 'Terminale',
      subjects: ['Mathématiques'],
      goals: 'Préparer le bac',
      specificNeeds: 'Tiers-temps',
      difficulties: 'Les dérivées',
      context: 'Changement de lycée en cours d’année',
    })
  })

  it("n'extrait ni prescription, ni traçabilité, ni droit AP — formateur", () => {
    expect(pickDeclarativeFields('teacher', FLAT_TEACHER_PEDAGOGICAL)).toEqual({
      levels: ['Seconde', 'Terminale'],
      subjects: ['Mathématiques'],
      experience: '8 ans en lycée',
      diplomas: 'Agrégation de mathématiques',
      specialties: ['Préparation Grand Oral'],
      particularities: 'Cours en soirée',
      cvDocumentId: 'cv-2026-001',
    })
  })

  it("n'emprunte jamais un champ à l'autre rôle", () => {
    // Le serveur refuse en 400 un champ de l'autre rôle, il ne l'ignore pas.
    expect(pickDeclarativeFields('teacher', FLAT_STUDENT_PEDAGOGICAL)).toEqual({
      subjects: ['Mathématiques'],
    })
    expect(pickDeclarativeFields('student', FLAT_TEACHER_PEDAGOGICAL)).toEqual({
      subjects: ['Mathématiques'],
    })
  })

  it('renvoie un objet vide pour un profil pédagogique jamais renseigné', () => {
    expect(pickDeclarativeFields('student', null)).toEqual({})
    expect(pickDeclarativeFields('teacher', undefined)).toEqual({})
  })
})

describe('pickPrescriptionFields', () => {
  it('extrait la seule section prescription du bloc à plat', () => {
    expect(pickPrescriptionFields('student', FLAT_STUDENT_PEDAGOGICAL)).toEqual({
      generalAssessment: 'Élève sérieuse',
      recommendedPace: 'Deux séances par semaine',
      recommendedTeacherProfile: 'Formateur patient',
      recommendedPath: 'Remise à niveau puis bac',
      recommendedActivities: 'Exercices guidés',
    })
    expect(pickPrescriptionFields('teacher', FLAT_TEACHER_PEDAGOGICAL)).toEqual({
      maxValidatedLevel: 'Terminale spécialité',
      audienceType: 'Collège et lycée',
      testResults: 'Test validé',
      testComments: 'Très bonne maîtrise',
    })
  })

  it("n'en ressort jamais `filledBy` ni `filledAt`, posés par le serveur", () => {
    const studentPrescription = pickPrescriptionFields('student', FLAT_STUDENT_PEDAGOGICAL)
    expect(studentPrescription).not.toHaveProperty('filledBy')
    expect(studentPrescription).not.toHaveProperty('filledAt')
  })
})

describe('pickDeclarativeDisplayFields', () => {
  it('ajoute le droit AP en lecture pour le formateur, sans le rendre éditable', () => {
    const displayed = pickDeclarativeDisplayFields('teacher', FLAT_TEACHER_PEDAGOGICAL)
    expect(displayed.isAnimateurPedagogique).toBe(true)
    expect(displayed).not.toHaveProperty('testResults')
  })

  it("n'ajoute rien de tel côté élève", () => {
    const displayed = pickDeclarativeDisplayFields('student', FLAT_STUDENT_PEDAGOGICAL)
    expect(displayed).not.toHaveProperty('isAnimateurPedagogique')
    expect(displayed).not.toHaveProperty('generalAssessment')
  })
})

describe('hasPrescriptionContent', () => {
  it('reconnaît une prescription réellement rédigée', () => {
    expect(hasPrescriptionContent('student', FLAT_STUDENT_PEDAGOGICAL)).toBe(true)
    expect(hasPrescriptionContent('teacher', FLAT_TEACHER_PEDAGOGICAL)).toBe(true)
  })

  it('ne prend pas une trace vide pour une prescription', () => {
    expect(hasPrescriptionContent('student', null)).toBe(false)
    expect(hasPrescriptionContent('student', { level: 'Terminale' })).toBe(false)
    expect(
      hasPrescriptionContent('student', {
        generalAssessment: '',
        recommendedPace: null,
        filledBy: 'rp-1',
      }),
    ).toBe(false)
  })
})

describe('resolvePedagogicalProfileKind', () => {
  it('suit `pedagogicalType` du serveur avant tout le reste', () => {
    // Source autoritative : elle prime même sur un rôle et des champs contraires.
    expect(resolvePedagogicalProfileKind('student', FLAT_TEACHER_PEDAGOGICAL, 'formateur')).toBe(
      'student',
    )
    expect(resolvePedagogicalProfileKind('teacher', FLAT_STUDENT_PEDAGOGICAL, 'eleve')).toBe(
      'teacher',
    )
  })

  it('retombe sur le rôle quand le serveur annonce `pedagogicalType: null`', () => {
    expect(resolvePedagogicalProfileKind(null, null, 'eleve')).toBe('student')
    expect(resolvePedagogicalProfileKind(null, null, 'formateur')).toBe('teacher')
    expect(resolvePedagogicalProfileKind(null, null, 'animateur_pedagogique')).toBe('teacher')
  })

  it("s'appuie sur les champs enregistrés quand ni type ni rôle ne tranchent", () => {
    expect(resolvePedagogicalProfileKind(null, { level: 'Terminale' }, undefined)).toBe('student')
    expect(resolvePedagogicalProfileKind(null, { difficulties: 'Les dérivées' }, undefined)).toBe(
      'student',
    )
    expect(resolvePedagogicalProfileKind(null, { context: 'Internat' }, undefined)).toBe('student')
    expect(resolvePedagogicalProfileKind(null, { experience: '8 ans' }, undefined)).toBe('teacher')
    expect(resolvePedagogicalProfileKind(null, { diplomas: 'Agrégation' }, undefined)).toBe(
      'teacher',
    )
    expect(resolvePedagogicalProfileKind(null, { cvDocumentId: 'cv-1' }, undefined)).toBe('teacher')
    expect(resolvePedagogicalProfileKind(null, { levels: ['Seconde'] }, undefined)).toBe('teacher')
  })

  it('reconnaît aussi un profil par ses seuls champs de prescription', () => {
    expect(
      resolvePedagogicalProfileKind(null, { recommendedTeacherProfile: 'Patient' }, undefined),
    ).toBe('student')
    expect(resolvePedagogicalProfileKind(null, { testComments: 'RAS' }, undefined)).toBe('teacher')
  })

  it('ne tranche pas sur `subjects`, présent sur les deux profils', () => {
    expect(resolvePedagogicalProfileKind(null, { subjects: ['Maths'] }, undefined)).toBe('unknown')
  })

  it('reste indéterminé sans type, ni rôle exploitable, ni donnée', () => {
    expect(resolvePedagogicalProfileKind(null, null, undefined)).toBe('unknown')
    expect(resolvePedagogicalProfileKind(undefined, null, undefined)).toBe('unknown')
    expect(resolvePedagogicalProfileKind(null, null, 'responsable_pedagogique')).toBe('unknown')
    expect(resolvePedagogicalProfileKind(null, null, 'parent_financeur')).toBe('unknown')
  })
})

describe('pedagogicalKindForRole', () => {
  it('associe chaque rôle à la forme de profil correspondante', () => {
    expect(pedagogicalKindForRole('eleve')).toBe('student')
    expect(pedagogicalKindForRole('formateur')).toBe('teacher')
    expect(pedagogicalKindForRole('animateur_pedagogique')).toBe('teacher')
    expect(pedagogicalKindForRole('parent_financeur')).toBe('unknown')
    expect(pedagogicalKindForRole(undefined)).toBe('unknown')
  })
})
