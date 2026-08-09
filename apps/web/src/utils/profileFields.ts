/**
 * Frontière API des profils — conversion et filtrage des champs échangés avec
 * `profile-service` (`GET /profiles/:userId`, `PUT /profiles/:userId/administrative`,
 * `PUT /profiles/:userId/pedagogical`, `PUT /profiles/:userId/prescription`).
 *
 * Trois responsabilités, toutes pures :
 *
 * 1. **Filtrage** — le serveur rejette en `400` tout champ hors liste
 *    (`forbidNonWhitelisted`). On ne renvoie donc jamais tel quel un bloc lu :
 *    on ne conserve que les champs documentés dans
 *    `docs/routes.md` § « Noms de champs des profils ».
 * 2. **Séparation des sections** — `GET /profiles/:userId` renvoie le profil
 *    pédagogique **à plat, sections confondues**. Les deux sections n'ont pas la
 *    même route d'écriture ni le même auteur : envoyer un champ de prescription
 *    à `PUT .../pedagogical` renvoie `400`, et réciproquement.
 * 3. **Conversion** — `subjects`, `levels`, `specialties` et `passions` sont des
 *    `string[]` côté API mais restent saisis en texte libre séparé par des virgules.
 *
 * Les listes ci-dessous sont contraintes par `satisfies` aux clés des interfaces
 * correspondantes : renommer un champ dans `src/types/profile.ts` sans l'aligner
 * ici casse la compilation.
 */

import type {
  AdministrativeProfileFields,
  PedagogicalProfileKind,
  PedagogicalProfileType,
  StudentDeclarativeFields,
  StudentPrescriptionFields,
  TeacherDeclarativeFields,
  TeacherPrescriptionFields,
} from '../types/profile'
import type { UserRole } from '../types/user'

// ─── Listes de champs autorisées (miroir de docs/routes.md) ───────────────────

export const ADMINISTRATIVE_FIELD_NAMES = [
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
] as const satisfies readonly (keyof AdministrativeProfileFields)[]

/**
 * Traçabilité du profil administratif, posée par le serveur : lisible, jamais
 * écrite. Elle n'entre pas dans `ADMINISTRATIVE_FIELD_NAMES`, qui est la liste
 * des champs **renvoyés en écriture** — les inclure dans un `PUT` vaudrait `400`.
 */
export const ADMINISTRATIVE_TRACEABILITY_FIELD_NAMES = ['createdAt', 'updatedAt'] as const

/**
 * Champs du bloc `administrative` affichés en lecture, dans l'ordre voulu à
 * l'écran.
 *
 * La liste est **close** et n'inclut ni `userId` ni `id` : le serveur renvoie ces
 * identifiants techniques dans le bloc, mais un UUID n'est pas une donnée de
 * fiche (règle UX du projet — les identifiants internes vivent dans les URLs,
 * les appels et les clés React, jamais comme libellé à l'écran). Sans cette
 * liste, le bloc était affiché tel quel et l'UUID s'y invitait.
 */
export const ADMINISTRATIVE_DISPLAY_FIELD_NAMES = [
  ...ADMINISTRATIVE_FIELD_NAMES,
  ...ADMINISTRATIVE_TRACEABILITY_FIELD_NAMES,
] as const

/** Section déclarative élève — seuls champs acceptés par `PUT .../pedagogical`. */
export const STUDENT_DECLARATIVE_FIELD_NAMES = [
  'level',
  'subjects',
  'goals',
  'specificNeeds',
  'difficulties',
  'context',
] as const satisfies readonly (keyof StudentDeclarativeFields)[]

/**
 * Section déclarative formateur. `testResults` n'y figure plus (prescription :
 * un formateur n'écrit pas ses propres résultats de test) et
 * `isAnimateurPedagogique` non plus (droit attribué par `POST .../ap-status`).
 */
export const TEACHER_DECLARATIVE_FIELD_NAMES = [
  'levels',
  'subjects',
  'experience',
  'diplomas',
  'specialties',
  'particularities',
  'cvDocumentId',
] as const satisfies readonly (keyof TeacherDeclarativeFields)[]

/** Section prescription élève — `PUT .../prescription`, RP seul. */
export const STUDENT_PRESCRIPTION_FIELD_NAMES = [
  'generalAssessment',
  'recommendedPace',
  'recommendedTeacherProfile',
  'recommendedPath',
  'recommendedActivities',
] as const satisfies readonly (keyof StudentPrescriptionFields)[]

/** Section prescription formateur — `PUT .../prescription`, RP seul. */
export const TEACHER_PRESCRIPTION_FIELD_NAMES = [
  'maxValidatedLevel',
  'audienceType',
  'testResults',
  'testComments',
] as const satisfies readonly (keyof TeacherPrescriptionFields)[]

/**
 * Traçabilité posée par le serveur. **Jamais envoyée** : les inclure dans un
 * corps d'écriture renvoie `400`.
 */
export const PRESCRIPTION_AUTHORSHIP_FIELD_NAMES = ['filledBy', 'filledAt'] as const

/**
 * Champs affichés en lecture dans la section déclarative. `isAnimateurPedagogique`
 * s'y ajoute pour le formateur : il est lisible dans le bloc `pedagogical` bien
 * qu'il ne soit pas éditable ici.
 */
export const TEACHER_READONLY_DISPLAY_FIELD_NAMES = ['isAnimateurPedagogique'] as const

/** Champs saisis en texte libre séparé par des virgules, `string[]` côté API. */
export const LIST_FIELD_NAMES = ['subjects', 'levels', 'specialties', 'passions'] as const

export function isListField(fieldName: string): boolean {
  return (LIST_FIELD_NAMES as readonly string[]).includes(fieldName)
}

// ─── Conversion texte ↔ tableau ───────────────────────────────────────────────

/**
 * Découpe une saisie « Mathématiques, Physique » en `['Mathématiques', 'Physique']`.
 * Une saisie vide donne un tableau vide, jamais `['']`.
 */
export function parseCommaSeparatedList(input: string): string[] {
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/**
 * Rassemble un `string[]` de l'API en une saisie lisible. Tolère une valeur
 * absente ou déjà textuelle (profils historiques) sans jamais afficher `[object Object]`.
 */
export function formatCommaSeparatedList(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string').join(', ')
  }
  return typeof value === 'string' ? value : ''
}

// ─── Filtrage des blocs lus ───────────────────────────────────────────────────

function pickFields<T>(raw: unknown, allowedNames: readonly string[]): T {
  if (!raw || typeof raw !== 'object') return {} as T
  const source = raw as Record<string, unknown>
  const picked: Record<string, unknown> = {}
  for (const fieldName of allowedNames) {
    if (source[fieldName] !== undefined) picked[fieldName] = source[fieldName]
  }
  return picked as T
}

/** Ne garde du bloc `administrative` que les champs réacceptés en écriture. */
export function pickAdministrativeFields(raw: unknown): AdministrativeProfileFields {
  return pickFields<AdministrativeProfileFields>(raw, ADMINISTRATIVE_FIELD_NAMES)
}

/**
 * Champs du bloc `administrative` affichés en lecture — champs éditables puis
 * traçabilité. Écarte les identifiants techniques du bloc (`userId`, `id`).
 */
export function pickAdministrativeDisplayFields(raw: unknown): Record<string, unknown> {
  return pickFields<Record<string, unknown>>(raw, ADMINISTRATIVE_DISPLAY_FIELD_NAMES)
}

/** Noms des champs déclaratifs de la forme demandée. */
export function declarativeFieldNames(
  pedagogicalType: PedagogicalProfileType,
): readonly string[] {
  return pedagogicalType === 'teacher'
    ? TEACHER_DECLARATIVE_FIELD_NAMES
    : STUDENT_DECLARATIVE_FIELD_NAMES
}

/** Noms des champs de prescription de la forme demandée. */
export function prescriptionFieldNames(
  pedagogicalType: PedagogicalProfileType,
): readonly string[] {
  return pedagogicalType === 'teacher'
    ? TEACHER_PRESCRIPTION_FIELD_NAMES
    : STUDENT_PRESCRIPTION_FIELD_NAMES
}

/**
 * Extrait la section déclarative du bloc `pedagogical` à plat.
 * Aucun champ de prescription ne peut en ressortir : le `PUT .../pedagogical`
 * qui les recevrait échouerait en `400`.
 */
export function pickDeclarativeFields(
  pedagogicalType: PedagogicalProfileType,
  raw: unknown,
): Record<string, unknown> {
  return pickFields<Record<string, unknown>>(raw, declarativeFieldNames(pedagogicalType))
}

/** Extrait la section prescription du bloc `pedagogical` à plat (lecture seule). */
export function pickPrescriptionFields(
  pedagogicalType: PedagogicalProfileType,
  raw: unknown,
): Record<string, unknown> {
  return pickFields<Record<string, unknown>>(raw, prescriptionFieldNames(pedagogicalType))
}

/**
 * Noms des champs affichés en lecture dans la section déclarative, dans l'ordre
 * voulu à l'écran.
 *
 * Exposé séparément du `pick` : l'écran doit aussi savoir **quels champs de
 * cette section sont masqués**, or un champ masqué est absent du bloc reçu et ne
 * peut donc pas être retrouvé à partir de lui.
 */
export function declarativeDisplayFieldNames(
  pedagogicalType: PedagogicalProfileType,
): readonly string[] {
  return pedagogicalType === 'teacher'
    ? [...TEACHER_DECLARATIVE_FIELD_NAMES, ...TEACHER_READONLY_DISPLAY_FIELD_NAMES]
    : [...STUDENT_DECLARATIVE_FIELD_NAMES]
}

/**
 * Champs affichés en lecture pour la section déclarative, dans l'ordre voulu à
 * l'écran (les champs absents du profil sont écartés à l'affichage).
 */
export function pickDeclarativeDisplayFields(
  pedagogicalType: PedagogicalProfileType,
  raw: unknown,
): Record<string, unknown> {
  return pickFields<Record<string, unknown>>(raw, declarativeDisplayFieldNames(pedagogicalType))
}

/**
 * Champs affichés par l'onglet « Statistiques pédagogiques ».
 *
 * `GET /profiles/:userId/statistics` renvoie en phase 1 le contenu du profil
 * pédagogique : on réutilise donc le même catalogue, sans savoir d'avance s'il
 * s'agit d'un profil élève ou formateur (le serveur annonce `profileType`, mais
 * une réponse peut l'omettre). L'union des deux formes suffit, l'ordre restant
 * déterministe.
 */
export const STATISTICS_DISPLAY_FIELD_NAMES = [
  ...STUDENT_DECLARATIVE_FIELD_NAMES,
  ...STUDENT_PRESCRIPTION_FIELD_NAMES,
  ...TEACHER_DECLARATIVE_FIELD_NAMES.filter(
    (fieldName) => !(STUDENT_DECLARATIVE_FIELD_NAMES as readonly string[]).includes(fieldName),
  ),
  ...TEACHER_PRESCRIPTION_FIELD_NAMES,
  ...TEACHER_READONLY_DISPLAY_FIELD_NAMES,
] as const

/** Ne garde des statistiques que les champs affichables, dans l'ordre d'écran. */
export function pickStatisticsDisplayFields(raw: unknown): Record<string, unknown> {
  return pickFields<Record<string, unknown>>(raw, STATISTICS_DISPLAY_FIELD_NAMES)
}

/** Une prescription a-t-elle été réellement remplie ? (au moins une valeur non vide) */
export function hasPrescriptionContent(
  pedagogicalType: PedagogicalProfileType,
  raw: unknown,
): boolean {
  const prescription = pickPrescriptionFields(pedagogicalType, raw)
  return Object.values(prescription).some(
    (value) => value !== null && value !== undefined && value !== '',
  )
}

// ─── Détermination de la forme du profil pédagogique ──────────────────────────

function hasAnyField(raw: unknown, fieldNames: readonly string[]): boolean {
  if (!raw || typeof raw !== 'object') return false
  const source = raw as Record<string, unknown>
  return fieldNames.some((fieldName) => source[fieldName] !== undefined)
}

/** Rôles dont le profil pédagogique a la forme « formateur ». */
export function pedagogicalKindForRole(role: UserRole | undefined): PedagogicalProfileKind {
  if (role === 'formateur' || role === 'animateur_pedagogique') return 'teacher'
  if (role === 'eleve') return 'student'
  return 'unknown'
}

/**
 * Champs qui, seuls, permettent de reconnaître un profil élève quand le serveur
 * n'a pas annoncé de type. `subjects` existe sur les deux profils et ne
 * discrimine jamais.
 */
const STUDENT_DISCRIMINATING_FIELD_NAMES = [
  'level',
  'goals',
  'specificNeeds',
  'difficulties',
  'context',
  'generalAssessment',
  'recommendedPace',
  'recommendedTeacherProfile',
  'recommendedPath',
  'recommendedActivities',
] as const

const TEACHER_DISCRIMINATING_FIELD_NAMES = [
  'levels',
  'experience',
  'diplomas',
  'specialties',
  'particularities',
  'cvDocumentId',
  'isAnimateurPedagogique',
  'maxValidatedLevel',
  'audienceType',
  'testResults',
  'testComments',
] as const

/**
 * Détermine la forme du profil pédagogique.
 *
 * Ordre de confiance :
 * 1. `pedagogicalType` renvoyé par le serveur — **source autoritative**, le front
 *    n'a plus à deviner ;
 * 2. le rôle, quand il est connu (son propre profil, ou un rôle cible su) ;
 * 3. les champs déjà enregistrés, pour un profil dont le type n'a pas été annoncé.
 *
 * Sans aucun des trois, la forme reste `unknown` et aucun formulaire n'est
 * proposé, plutôt que de risquer d'écrire dans la mauvaise table.
 */
export function resolvePedagogicalProfileKind(
  pedagogicalType: PedagogicalProfileType | null | undefined,
  pedagogicalBlock: unknown,
  fallbackRole: UserRole | undefined,
): PedagogicalProfileKind {
  if (pedagogicalType === 'student' || pedagogicalType === 'teacher') return pedagogicalType

  const kindFromRole = pedagogicalKindForRole(fallbackRole)
  if (kindFromRole !== 'unknown') return kindFromRole

  if (hasAnyField(pedagogicalBlock, STUDENT_DISCRIMINATING_FIELD_NAMES)) return 'student'
  if (hasAnyField(pedagogicalBlock, TEACHER_DISCRIMINATING_FIELD_NAMES)) return 'teacher'
  return 'unknown'
}
