/**
 * Intention de liaison d'un second compte lors d'une inscription.
 *
 * Arbitrage d'architecture du 2026-08-09 (docs/architecture.md) : rattacher un
 * compte EXISTANT et créer un compte LIÉ sont deux intentions distinctes, qui
 * doivent être explicites dans le DTO. Le mode porte l'intention ; le champ
 * `<prefix>LoginIdentifier` porte l'identifiant de connexion du compte concerné
 * — un seul nom pour une seule donnée (règle « un seul nom par donnée »), dont
 * le rôle est fixé par le mode :
 *   - `existing` : identifiant du compte déjà en base à rattacher (404 sinon) ;
 *   - `new`      : identifiant de connexion CHOISI pour le compte à créer
 *                  (409 s'il est déjà pris). Jamais dérivé de l'email.
 */
export enum LinkedAccountMode {
  /** Aucun compte lié dans cet appel (équivalent à ne pas envoyer le champ). */
  NONE = 'none',
  /** Rattacher un compte déjà existant, identifié par son loginIdentifier. */
  EXISTING = 'existing',
  /** Créer le compte lié, avec un identifiant de connexion choisi. */
  NEW = 'new',
}

/** Préfixe des champs de liaison : `parent*` côté élève, `student*` côté parent. */
export type LinkedAccountFieldPrefix = 'parent' | 'student';

/** Champs de liaison, à plat, tels qu'ils apparaissent dans les DTO d'inscription. */
export interface LinkedAccountIntent {
  mode?: LinkedAccountMode;
  loginIdentifier?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

const isFilled = (value?: string): boolean => typeof value === 'string' && value.trim().length > 0;

/**
 * Vérifie la cohérence entre le mode déclaré et les champs de liaison fournis.
 * Retourne la liste des violations (vide si l'intention est cohérente).
 *
 * Aucun champ n'est jamais ignoré silencieusement : un champ sans effet dans le
 * mode choisi est une erreur explicite, pas une donnée jetée.
 */
export function checkLinkedAccountIntent(
  fieldPrefix: LinkedAccountFieldPrefix,
  intent: LinkedAccountIntent,
): string[] {
  const modeField = `${fieldPrefix}AccountMode`;
  const identifierField = `${fieldPrefix}LoginIdentifier`;
  const emailField = `${fieldPrefix}Email`;
  const passwordField = `${fieldPrefix}Password`;
  const firstNameField = `${fieldPrefix}FirstName`;
  const lastNameField = `${fieldPrefix}LastName`;

  const providedFields: string[] = [];
  if (isFilled(intent.loginIdentifier)) providedFields.push(identifierField);
  if (isFilled(intent.email)) providedFields.push(emailField);
  if (isFilled(intent.password)) providedFields.push(passwordField);
  if (isFilled(intent.firstName)) providedFields.push(firstNameField);
  if (isFilled(intent.lastName)) providedFields.push(lastNameField);

  const mode = intent.mode ?? LinkedAccountMode.NONE;
  const violations: string[] = [];

  if (mode === LinkedAccountMode.NONE) {
    if (providedFields.length > 0) {
      violations.push(
        `${modeField} is required when ${fieldPrefix} account fields are provided (${providedFields.join(', ')}): ` +
          `use '${LinkedAccountMode.EXISTING}' to attach an existing account, ` +
          `'${LinkedAccountMode.NEW}' to create one.`,
      );
    }
    return violations;
  }

  if (mode === LinkedAccountMode.EXISTING) {
    if (!isFilled(intent.loginIdentifier)) {
      violations.push(`${identifierField} is required when ${modeField} is '${LinkedAccountMode.EXISTING}'.`);
    }
    const forbiddenFields = [
      isFilled(intent.email) ? emailField : null,
      isFilled(intent.password) ? passwordField : null,
      isFilled(intent.firstName) ? firstNameField : null,
      isFilled(intent.lastName) ? lastNameField : null,
    ].filter((fieldName): fieldName is string => fieldName !== null);

    if (forbiddenFields.length > 0) {
      violations.push(
        `${forbiddenFields.join(', ')} must not be sent when ${modeField} is '${LinkedAccountMode.EXISTING}': ` +
          `an existing account is identified by ${identifierField} only. ` +
          `Use ${modeField}='${LinkedAccountMode.NEW}' to create an account instead.`,
      );
    }
    return violations;
  }

  // LinkedAccountMode.NEW
  const missingFields = [
    isFilled(intent.loginIdentifier) ? null : identifierField,
    isFilled(intent.email) ? null : emailField,
    isFilled(intent.firstName) ? null : firstNameField,
    isFilled(intent.lastName) ? null : lastNameField,
  ].filter((fieldName): fieldName is string => fieldName !== null);

  if (missingFields.length > 0) {
    violations.push(
      `${missingFields.join(', ')} ${missingFields.length > 1 ? 'are' : 'is'} required when ` +
        `${modeField} is '${LinkedAccountMode.NEW}'. The login identifier of a created account is chosen, never derived.`,
    );
  }

  return violations;
}
