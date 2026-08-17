/**
 * Catalogue des champs de profil dont la visibilité est réglable, et
 * visibilité par défaut de chaque bloc (docs/proposition-profils.md §8,
 * socle validé le 2026-08-09, révisé le 2026-08-17).
 *
 * Ce fichier est la SOURCE DE VÉRITÉ de deux choses :
 *  1. la liste close des `fieldName` acceptés par
 *     PUT /profiles/:userId/field-visibility — un nom hors catalogue est
 *     refusé en 400, jamais absorbé en silence ;
 *  2. la visibilité par défaut appliquée à un champ pour lequel l'utilisateur
 *     n'a enregistré aucune dérogation.
 *
 * RÉVISION DU 2026-08-17 (arbitrage produit rapporté par l'orchestrateur,
 * à consigner dans `docs/architecture.md` — absent du fichier au moment de
 * cette session, voir le rapport de session) :
 *  - `firstName` et `lastName` NE FONT PLUS PARTIE DU CATALOGUE. Ils ne sont
 *    donc plus réglables (PUT les refuse en 400, « champ inconnu ») et ne
 *    sont jamais masqués en lecture : `filterProfileBlock` (profile-
 *    visibility-filter.ts) laisse passer sans condition toute clé absente du
 *    catalogue d'un bloc — exactement le mécanisme qui protège déjà `userId`
 *    et consorts, sans qu'il soit besoin de les déclarer « structurels » (ce
 *    ne sont pas des métadonnées mais des données personnelles, jugées non
 *    masquables par décision produit).
 *  - L'ancien « socle élargi » (`avatarUrl`, `level`, `subjects` visibles des
 *    personnes liées, tout le reste masqué par défaut) disparaît. TOUS les
 *    champs restant au catalogue — section déclarative ET section
 *    prescription — partagent désormais le MÊME défaut : `linked`, visible
 *    des personnes liées. Il n'y a donc plus de distinction « champ du
 *    socle » ; un défaut plus restrictif (`self`) reste atteignable via un
 *    réglage explicite du titulaire.
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

/**
 * Défaut UNIQUE appliqué à tout champ du catalogue sans dérogation
 * enregistrée, depuis la révision du 2026-08-17. Conservé comme constante
 * nommée (plutôt qu'une littérale répétée) pour que le prochain changement de
 * défaut reste un seul endroit à modifier.
 */
const CATALOG_DEFAULT_AUDIENCE: FieldAudience = 'linked';

function define(
  fieldName: string,
  block: ProfileBlock,
  options: { isPrescription?: boolean; isReserved?: boolean } = {},
): FieldVisibilityDefinition {
  return {
    fieldName,
    block,
    defaultAudience: CATALOG_DEFAULT_AUDIENCE,
    ...options,
  };
}

export const FIELD_VISIBILITY_CATALOG: readonly FieldVisibilityDefinition[] = [
  // --- Profil administratif -------------------------------------------------
  // `firstName` et `lastName` ont quitté le catalogue le 2026-08-17 : ils ne
  // sont plus réglables et ne sont jamais masqués (voir l'en-tête de fichier).
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
  // Ces champs suivent le défaut commun `linked` depuis le 2026-08-17, comme
  // tout le reste du catalogue ; le titulaire peut les repasser à `self` s'il
  // juge une situation familiale, scolaire ou l'équipement du domicile trop
  // sensible pour être partagée sans décision explicite.
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
