/**
 * Frontière API des profils — conversion et filtrage des champs échangés avec
 * `profile-service` (`GET /profiles/:userId`, `PUT /profiles/:userId/administrative`,
 * `PUT /profiles/:userId/pedagogical`).
 *
 * Deux responsabilités, toutes deux pures :
 *
 * 1. **Filtrage** — le serveur rejette en `400` tout champ hors liste
 *    (`forbidNonWhitelisted`). On ne renvoie donc jamais tel quel un bloc lu :
 *    on ne conserve que les champs documentés dans
 *    `docs/routes.md` § « Noms de champs des profils ».
 * 2. **Conversion** — `subjects`, `levels` et `passions` sont des `string[]` côté
 *    API mais restent saisis en texte libre séparé par des virgules côté UI.
 *
 * Les listes ci-dessous sont contraintes par `satisfies` aux clés des interfaces
 * correspondantes : renommer un champ dans `src/types/profile.ts` sans l'aligner
 * ici casse la compilation.
 */

import type {
  AdministrativeProfileFields,
  PedagogicalProfileKind,
  StudentPedagogicalProfileFields,
  TeacherPedagogicalProfileFields,
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

export const STUDENT_PEDAGOGICAL_FIELD_NAMES = [
  'level',
  'goals',
  'specificNeeds',
  'subjects',
] as const satisfies readonly (keyof StudentPedagogicalProfileFields)[]

export const TEACHER_PEDAGOGICAL_FIELD_NAMES = [
  'levels',
  'experience',
  'testResults',
  'subjects',
  'isAnimateurPedagogique',
] as const satisfies readonly (keyof TeacherPedagogicalProfileFields)[]

/**
 * Champs qui, seuls, permettent au serveur de savoir qu'il s'agit d'un profil
 * élève. `subjects` existe sur les deux profils et ne discrimine jamais.
 */
const STUDENT_DISCRIMINATING_FIELD_NAMES = ['level', 'goals', 'specificNeeds'] as const

const TEACHER_DISCRIMINATING_FIELD_NAMES = [
  'levels',
  'experience',
  'testResults',
  'isAnimateurPedagogique',
] as const

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

export function pickStudentPedagogicalFields(raw: unknown): StudentPedagogicalProfileFields {
  return pickFields<StudentPedagogicalProfileFields>(raw, STUDENT_PEDAGOGICAL_FIELD_NAMES)
}

export function pickTeacherPedagogicalFields(raw: unknown): TeacherPedagogicalProfileFields {
  return pickFields<TeacherPedagogicalProfileFields>(raw, TEACHER_PEDAGOGICAL_FIELD_NAMES)
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
 * Détermine la forme du profil pédagogique à éditer.
 *
 * Le contenu déjà enregistré fait foi : il indique la table réellement utilisée.
 * À défaut (profil pédagogique jamais renseigné — état normal), on retombe sur le
 * rôle, qui n'est fiable que lorsque l'utilisateur édite son propre profil :
 * `GET /profiles/:userId` n'expose pas le rôle de la personne consultée.
 * Sans aucun des deux, la forme reste `unknown` et aucun formulaire n'est proposé.
 */
export function resolvePedagogicalProfileKind(
  pedagogicalBlock: unknown,
  fallbackRole: UserRole | undefined,
): PedagogicalProfileKind {
  if (hasAnyField(pedagogicalBlock, STUDENT_DISCRIMINATING_FIELD_NAMES)) return 'student'
  if (hasAnyField(pedagogicalBlock, TEACHER_DISCRIMINATING_FIELD_NAMES)) return 'teacher'
  return pedagogicalKindForRole(fallbackRole)
}
