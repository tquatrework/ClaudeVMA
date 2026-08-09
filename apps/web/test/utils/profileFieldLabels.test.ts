/**
 * Tests du point unique de correspondance nom technique → libellé affiché
 * (`src/utils/profileFieldLabels.ts`).
 *
 * Objet de ces tests : empêcher le retour d'un libellé **anglais** à l'écran.
 * Le défaut constaté le 2026-08-09 sur `/profiles/:userId` — « User id »,
 * « Created at », « Updated at » affichés dans l'onglet administratif — ne venait
 * pas d'une traduction ratée mais d'un champ **absent** de la table : le repli de
 * `getProfileFieldLabel` découpe alors le camelCase et rend le nom technique
 * anglais tel quel. Un test qui se contenterait de vérifier les libellés présents
 * n'aurait rien vu.
 *
 * D'où trois garde-fous :
 * 1. **couverture** — tout champ affichable par un écran de profil a un libellé
 *    explicite, donc aucun ne retombe sur le repli ;
 * 2. **repli** — aucun libellé n'est égal au découpage camelCase de sa clé, la
 *    signature exacte d'un champ oublié puis « traduit » à l'identique ;
 * 3. **vocabulaire** — aucun libellé ne contient de mot anglais courant.
 *
 * Règle appliquée : `docs/architecture.md` § « Langue de l'application » —
 * anglais dans le code, français à l'écran.
 */

import { describe, it, expect } from 'vitest'
import {
  FIELD_VISIBILITY_AUDIENCE_DESCRIPTIONS,
  FIELD_VISIBILITY_AUDIENCE_LABELS,
  FIELD_VISIBILITY_BLOCK_LABELS,
  PROFILE_FIELD_HINTS,
  PROFILE_FIELD_LABELS,
  getProfileFieldLabel,
} from '../../src/utils/profileFieldLabels'
import {
  FILTERED_PROFILE_DESCRIPTION,
  FILTERED_PROFILE_TITLE,
  NOT_SHARED_PLACEHOLDER,
  PRESCRIPTION_NOT_SHARED_MESSAGE,
} from '../../src/utils/profileVisibility'
import {
  ADMINISTRATIVE_DISPLAY_FIELD_NAMES,
  PRESCRIPTION_AUTHORSHIP_FIELD_NAMES,
  STUDENT_DECLARATIVE_FIELD_NAMES,
  STUDENT_PRESCRIPTION_FIELD_NAMES,
  TEACHER_DECLARATIVE_FIELD_NAMES,
  TEACHER_PRESCRIPTION_FIELD_NAMES,
  TEACHER_READONLY_DISPLAY_FIELD_NAMES,
} from '../../src/utils/profileFields'

/**
 * Catalogue de visibilité champ par champ, tel que renvoyé par
 * `GET /profiles/:userId/field-visibility` (34 champs, liste close reprise de
 * `docs/routes.md` § « Visibilité champ par champ »). L'écran de confidentialité
 * affiche le libellé de **chacun** de ces champs.
 */
const FIELD_VISIBILITY_CATALOG_NAMES = [
  'addressLine1',
  'addressLine2',
  'audienceType',
  'avatarUrl',
  'birthDate',
  'city',
  'comments',
  'context',
  'country',
  'cvDocumentId',
  'department',
  'difficulties',
  'diplomas',
  'experience',
  'firstName',
  'generalAssessment',
  'goals',
  'lastName',
  'level',
  'levels',
  'maxValidatedLevel',
  'particularities',
  'passions',
  'phone',
  'postalCode',
  'recommendedActivities',
  'recommendedPace',
  'recommendedPath',
  'recommendedTeacherProfile',
  'specialties',
  'specificNeeds',
  'subjects',
  'testComments',
  'testResults',
] as const

/** Tout champ qu'un écran de profil peut afficher, toutes vues confondues. */
const DISPLAYABLE_FIELD_NAMES = [
  ...ADMINISTRATIVE_DISPLAY_FIELD_NAMES,
  ...STUDENT_DECLARATIVE_FIELD_NAMES,
  ...TEACHER_DECLARATIVE_FIELD_NAMES,
  ...TEACHER_READONLY_DISPLAY_FIELD_NAMES,
  ...STUDENT_PRESCRIPTION_FIELD_NAMES,
  ...TEACHER_PRESCRIPTION_FIELD_NAMES,
  ...PRESCRIPTION_AUTHORSHIP_FIELD_NAMES,
  ...FIELD_VISIBILITY_CATALOG_NAMES,
  'loginIdentifier',
]

/** Repli de `getProfileFieldLabel` : `createdAt` → « Created at ». */
function humanizeCamelCase(fieldName: string): string {
  const spaced = fieldName.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/**
 * Mots anglais qui n'ont aucune raison d'apparaître dans un libellé français.
 * Volontairement limité aux termes sans homographe français, accents retirés
 * (`type`, `date`, `postal`, `document`, `experience` en sont donc absents :
 * « expérience » désaccentué s'écrit comme le mot anglais). Un faux positif
 * rendrait ce test inutilisable, et la règle 2 couvre déjà les champs
 * simplement oubliés.
 */
const ENGLISH_WORDS = [
  'user',
  'created',
  'updated',
  'filled',
  'first',
  'last',
  'birth',
  'phone',
  'address',
  'city',
  'country',
  'avatar',
  'level',
  'levels',
  'subjects',
  'goals',
  'needs',
  'context',
  'diplomas',
  'specialties',
  'assessment',
  'recommended',
  'audience',
  'results',
  'comments',
  'login',
  'identifier',
  'name',
  'settings',
  'profile',
  'visibility',
  'hidden',
]

/** Retire les accents pour comparer « Département » et `department` sans faux positif. */
function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function findEnglishWords(label: string): string[] {
  const normalized = stripAccents(label).toLowerCase()
  return ENGLISH_WORDS.filter((word) => new RegExp(`\\b${word}\\b`).test(normalized))
}

describe('PROFILE_FIELD_LABELS — aucun libellé anglais', () => {
  it('couvre tout champ affichable par un écran de profil', () => {
    const missingFieldNames = DISPLAYABLE_FIELD_NAMES.filter(
      (fieldName) => PROFILE_FIELD_LABELS[fieldName] === undefined,
    )

    // Un champ manquant retombe sur le repli camelCase, donc sur de l'anglais.
    expect(missingFieldNames).toEqual([])
  })

  it("n'a aucun libellé égal au repli camelCase de sa clé", () => {
    const untranslatedFieldNames = Object.entries(PROFILE_FIELD_LABELS)
      .filter(([fieldName, label]) => label === humanizeCamelCase(fieldName))
      .map(([fieldName]) => fieldName)

    expect(untranslatedFieldNames).toEqual([])
  })

  it("n'emploie aucun mot anglais dans les libellés de champs", () => {
    const offendingLabels = Object.entries(PROFILE_FIELD_LABELS)
      .map(([fieldName, label]) => [fieldName, findEnglishWords(label)] as const)
      .filter(([, englishWords]) => englishWords.length > 0)

    expect(offendingLabels).toEqual([])
  })

  it("n'emploie aucun mot anglais dans les précisions et les libellés de l'écran de visibilité", () => {
    const allOtherLabels = [
      ...Object.values(PROFILE_FIELD_HINTS),
      ...Object.values(FIELD_VISIBILITY_BLOCK_LABELS),
      ...Object.values(FIELD_VISIBILITY_AUDIENCE_LABELS),
      ...Object.values(FIELD_VISIBILITY_AUDIENCE_DESCRIPTIONS),
      // Mentions du filtrage en lecture — même règle, même garde-fou : elles
      // sont vues par tout lecteur d'une fiche filtrée.
      NOT_SHARED_PLACEHOLDER,
      FILTERED_PROFILE_TITLE,
      FILTERED_PROFILE_DESCRIPTION,
      PRESCRIPTION_NOT_SHARED_MESSAGE,
    ]

    const offendingLabels = allOtherLabels.filter((label) => findEnglishWords(label).length > 0)

    expect(offendingLabels).toEqual([])
  })

  it('nomme en français la traçabilité du profil administratif', () => {
    // Champs à l'origine du défaut du 2026-08-09.
    expect(getProfileFieldLabel('createdAt')).toBe('Profil créé le')
    expect(getProfileFieldLabel('updatedAt')).toBe('Dernière modification')
  })
})

describe('getProfileFieldLabel', () => {
  it('rend le libellé français d’un champ connu', () => {
    expect(getProfileFieldLabel('difficulties')).toBe('Difficultés rencontrées')
  })

  it('replie un champ inconnu sans afficher le nom technique brut', () => {
    // Repli de secours uniquement : aucun champ affichable ne doit y arriver.
    expect(getProfileFieldLabel('someUnknownField')).toBe('Some unknown field')
  })
})
