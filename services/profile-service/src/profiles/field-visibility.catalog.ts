/**
 * Catalogue des champs de profil dont la visibilité est réglable, et
 * visibilité par défaut de chaque bloc (docs/proposition-profils.md §8,
 * socle validé le 2026-08-09).
 *
 * Ce fichier est la SOURCE DE VÉRITÉ de deux choses :
 *  1. la liste close des `fieldName` acceptés par
 *     PUT /profiles/:userId/field-visibility — un nom hors catalogue est
 *     refusé en 400, jamais absorbé en silence ;
 *  2. la visibilité par défaut appliquée à un champ pour lequel l'utilisateur
 *     n'a enregistré aucune dérogation.
 *
 * Règle du socle : `firstName`, `lastName`, `avatarUrl`, `level` et `subjects`
 * sont visibles des personnes liées par défaut. TOUT LE RESTE est masqué par
 * défaut (`self`) — adresse, téléphone, date de naissance, difficultés,
 * contexte, besoins spécifiques, et l'intégralité de la section prescription.
 */

/** Audiences possibles pour un champ de profil. */
export const FIELD_AUDIENCES = ['self', 'linked', 'all'] as const;

export type FieldAudience = (typeof FIELD_AUDIENCES)[number];

/** Blocs de profil auxquels un champ peut appartenir. */
export type ProfileBlock =
  | 'administrative'
  | 'pedagogical-student'
  | 'pedagogical-teacher';

export interface FieldVisibilityDefinition {
  /** Nom technique du champ, en anglais, tel qu'exposé par l'API. */
  fieldName: string;
  /** Bloc auquel il appartient — sert au regroupement côté front. */
  block: ProfileBlock;
  /** Visibilité appliquée en l'absence de dérogation enregistrée. */
  defaultAudience: FieldAudience;
  /**
   * true pour un champ de la section prescription : le titulaire peut régler
   * qui d'autre le voit, mais il ne l'écrit jamais lui-même.
   */
  isPrescription?: boolean;
  /**
   * true pour un réglage conservé alors qu'aucune colonne ne porte encore la
   * donnée. Cas de `comments` : la préférence existait dans le modèle hérité
   * (`restrict_comments_to_principal_teacher`) et est reprise sans perte par
   * la migration, mais le champ lui-même n'est porté par aucune table à ce
   * jour. Exactement la situation dans laquelle se trouvait
   * `hide_difficulties_from_contacts` avant la création de `difficulties`.
   */
  isReserved?: boolean;
}

/** Socle visible par défaut des personnes liées (§8, validé le 2026-08-09). */
export const DEFAULT_LINKED_FIELDS = [
  'firstName',
  'lastName',
  'avatarUrl',
  'level',
  'subjects',
] as const;

function define(
  fieldName: string,
  block: ProfileBlock,
  options: { isPrescription?: boolean; isReserved?: boolean } = {},
): FieldVisibilityDefinition {
  const isSocle = (DEFAULT_LINKED_FIELDS as readonly string[]).includes(fieldName);
  return {
    fieldName,
    block,
    defaultAudience: isSocle ? 'linked' : 'self',
    ...options,
  };
}

export const FIELD_VISIBILITY_CATALOG: readonly FieldVisibilityDefinition[] = [
  // --- Profil administratif -------------------------------------------------
  define('firstName', 'administrative'),
  define('lastName', 'administrative'),
  define('avatarUrl', 'administrative'),
  define('birthDate', 'administrative'),
  define('phone', 'administrative'),
  define('addressLine1', 'administrative'),
  define('addressLine2', 'administrative'),
  define('postalCode', 'administrative'),
  define('city', 'administrative'),
  define('country', 'administrative'),
  // `department` retiré du catalogue le 2026-08-11 en même temps que la colonne.
  define('passions', 'administrative'),

  // --- Profil pédagogique élève — section déclarative ------------------------
  define('level', 'pedagogical-student'),
  define('subjects', 'pedagogical-student'),
  define('goals', 'pedagogical-student'),
  define('specificNeeds', 'pedagogical-student'),
  define('difficulties', 'pedagogical-student'),
  // `context` remplacé le 2026-08-11 par `familyContext` + `schoolContext`.
  // Les trois nouveaux champs restent HORS SOCLE (`self` par défaut) : le socle
  // se limite à firstName/lastName/avatarUrl/level/subjects, et une situation
  // familiale, une situation scolaire ou l'équipement du domicile sont des
  // données sensibles qui n'ont pas à être visibles sans décision de l'élève.
  // `schoolName` suit la même règle : nommer l'établissement d'un mineur
  // permet de le localiser.
  define('schoolName', 'pedagogical-student'),
  define('familyContext', 'pedagogical-student'),
  define('schoolContext', 'pedagogical-student'),
  define('equipment', 'pedagogical-student'),
  define('comments', 'pedagogical-student', { isReserved: true }),

  // --- Profil pédagogique élève — section prescription -----------------------
  define('generalAssessment', 'pedagogical-student', { isPrescription: true }),
  define('recommendedPace', 'pedagogical-student', { isPrescription: true }),
  define('recommendedTeacherProfile', 'pedagogical-student', { isPrescription: true }),
  define('recommendedPath', 'pedagogical-student', { isPrescription: true }),
  define('recommendedActivities', 'pedagogical-student', { isPrescription: true }),

  // --- Profil pédagogique formateur — section déclarative --------------------
  define('levels', 'pedagogical-teacher'),
  define('experience', 'pedagogical-teacher'),
  define('diplomas', 'pedagogical-teacher'),
  define('specialties', 'pedagogical-teacher'),
  define('particularities', 'pedagogical-teacher'),
  define('cvDocumentId', 'pedagogical-teacher'),

  // --- Profil pédagogique formateur — section prescription -------------------
  define('maxValidatedLevel', 'pedagogical-teacher', { isPrescription: true }),
  define('audienceType', 'pedagogical-teacher', { isPrescription: true }),
  define('testResults', 'pedagogical-teacher', { isPrescription: true }),
  define('testComments', 'pedagogical-teacher', { isPrescription: true }),
];

const CATALOG_BY_FIELD_NAME = new Map(
  FIELD_VISIBILITY_CATALOG.map((definition) => [definition.fieldName, definition]),
);

/** Liste close des noms de champs acceptés, triée pour des messages stables. */
export const KNOWN_VISIBILITY_FIELD_NAMES: readonly string[] = FIELD_VISIBILITY_CATALOG
  .map((definition) => definition.fieldName)
  .sort();

export function isKnownVisibilityField(fieldName: string): boolean {
  return CATALOG_BY_FIELD_NAME.has(fieldName);
}

export function findVisibilityField(
  fieldName: string,
): FieldVisibilityDefinition | undefined {
  return CATALOG_BY_FIELD_NAME.get(fieldName);
}

/** Visibilité par défaut d'un champ connu ; `self` pour tout champ inconnu. */
export function defaultAudienceOf(fieldName: string): FieldAudience {
  return CATALOG_BY_FIELD_NAME.get(fieldName)?.defaultAudience ?? 'self';
}

export function isValidAudience(value: unknown): value is FieldAudience {
  return typeof value === 'string' && (FIELD_AUDIENCES as readonly string[]).includes(value);
}
