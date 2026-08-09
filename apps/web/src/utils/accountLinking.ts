/**
 * accountLinking — logique partagée pour lier un compte élève à un compte
 * parent financeur (ou l'inverse) directement lors de l'inscription, en
 * s'appuyant sur les champs optionnels de `POST /accounts/students` et
 * `POST /accounts/parents` (docs/routes.md).
 *
 * Utilisé par StudentRegistrationPage / ParentRegistrationPage (formulaire
 * d'inscription) ainsi que par LinkedAccountSection (composant de saisie).
 *
 * Règle de contrat serveur (arbitrage du 2026-08-09) : l'intention de liaison
 * est **déclarée**, jamais devinée. Dès qu'un champ `parent*` / `student*` est
 * transmis, `parentAccountMode` / `studentAccountMode` est obligatoire, et un
 * compte créé en parallèle reçoit un identifiant de connexion **choisi**, jamais
 * dérivé de son email.
 */

import type {
  LinkedAccountFormData,
  LinkedAccountMode,
  LinkedAccountRelation,
} from '../types/accounts'

export type {
  LinkedAccountFormData,
  LinkedAccountMode,
  LinkedAccountRelation,
} from '../types/accounts'

/** Longueur minimale imposée par le serveur sur un identifiant de connexion. */
export const MIN_LOGIN_IDENTIFIER_LENGTH = 3

export const INITIAL_LINKED_ACCOUNT_DATA: LinkedAccountFormData = {
  mode: 'none',
  loginIdentifier: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
}

interface LinkedAccountLabels {
  /** Libellé nominal utilisé dans les titres et libellés de champs ("parent financeur", "élève") */
  target: string
  /** Même libellé inséré dans une phrase ("du parent financeur", "de l'élève") */
  targetSentence: string
}

export const LINKED_ACCOUNT_LABELS: Record<LinkedAccountRelation, LinkedAccountLabels> = {
  parent: { target: 'parent financeur', targetSentence: 'du parent financeur' },
  student: { target: 'élève', targetSentence: "de l'élève" },
}

export interface ParentLinkFields {
  parentAccountMode?: LinkedAccountMode
  parentLoginIdentifier?: string
  parentEmail?: string
  parentFirstName?: string
  parentLastName?: string
  parentPassword?: string
}

export interface StudentLinkFields {
  studentAccountMode?: LinkedAccountMode
  studentLoginIdentifier?: string
  studentEmail?: string
  studentFirstName?: string
  studentLastName?: string
  studentPassword?: string
}

const FIELD_KEYS: Record<
  LinkedAccountRelation,
  {
    accountMode: string
    loginIdentifier: string
    email: string
    firstName: string
    lastName: string
    password: string
  }
> = {
  parent: {
    accountMode: 'parentAccountMode',
    loginIdentifier: 'parentLoginIdentifier',
    email: 'parentEmail',
    firstName: 'parentFirstName',
    lastName: 'parentLastName',
    password: 'parentPassword',
  },
  student: {
    accountMode: 'studentAccountMode',
    loginIdentifier: 'studentLoginIdentifier',
    email: 'studentEmail',
    firstName: 'studentFirstName',
    lastName: 'studentLastName',
    password: 'studentPassword',
  },
}

/**
 * Construit les champs optionnels à fusionner dans le payload d'inscription
 * (RegisterStudentPayload / RegisterParentPayload) à partir de l'état de saisie
 * du bloc de liaison.
 *
 * - `lockedLoginIdentifier` (venant d'un paramètre d'URL, ex. `?parentLoginIdentifier=...`)
 *   est toujours prioritaire : le compte cible existe déjà et est identifié sans
 *   ambiguïté — c'est donc le mode `existing`.
 * - Sinon, selon le mode choisi par l'utilisateur : rien (`none`, aucun champ
 *   n'est transmis), rattachement d'un compte existant (`existing`) ou création
 *   d'un nouveau compte lié (`new`, avec l'identifiant de connexion choisi).
 */
export function buildLinkedAccountFields(
  relation: LinkedAccountRelation,
  data: LinkedAccountFormData,
  lockedLoginIdentifier?: string | null,
): ParentLinkFields & StudentLinkFields {
  const keys = FIELD_KEYS[relation]

  if (lockedLoginIdentifier) {
    return {
      [keys.accountMode]: 'existing',
      [keys.loginIdentifier]: lockedLoginIdentifier,
    }
  }

  if (data.mode === 'existing' && data.loginIdentifier.trim()) {
    return {
      [keys.accountMode]: 'existing',
      [keys.loginIdentifier]: data.loginIdentifier.trim(),
    }
  }

  if (data.mode === 'new' && data.email.trim()) {
    return {
      [keys.accountMode]: 'new',
      [keys.loginIdentifier]: data.loginIdentifier.trim(),
      [keys.email]: data.email.trim(),
      [keys.firstName]: data.firstName.trim(),
      [keys.lastName]: data.lastName.trim(),
      [keys.password]: data.password.trim() || undefined,
    }
  }

  return {}
}

/**
 * Valide l'état de saisie du bloc de liaison avant soumission.
 * Retourne un message d'erreur lisible, ou `null` si valide.
 *
 * @param mainLoginIdentifier identifiant de connexion saisi pour le compte
 *   principal, s'il y en a un : deux comptes ne peuvent pas porter le même.
 */
export function validateLinkedAccountData(
  relation: LinkedAccountRelation,
  data: LinkedAccountFormData,
  lockedLoginIdentifier?: string | null,
  mainLoginIdentifier?: string | null,
): string | null {
  if (lockedLoginIdentifier) return null

  const { target, targetSentence } = LINKED_ACCOUNT_LABELS[relation]
  const trimmedLoginIdentifier = data.loginIdentifier.trim()

  if (data.mode === 'existing' && !trimmedLoginIdentifier) {
    return `Veuillez renseigner l'identifiant ${targetSentence} à lier, ou choisissez "Ne rien lier maintenant".`
  }

  if (data.mode === 'new') {
    if (!data.email.trim() || !data.firstName.trim() || !data.lastName.trim()) {
      return `L'email, le prénom et le nom ${targetSentence} sont requis pour créer un nouveau compte lié.`
    }
    if (!trimmedLoginIdentifier) {
      return `L'identifiant de connexion ${targetSentence} est requis : c'est avec lui que ce compte se connectera.`
    }
  }

  if (trimmedLoginIdentifier && trimmedLoginIdentifier.length < MIN_LOGIN_IDENTIFIER_LENGTH) {
    return `L'identifiant de connexion ${targetSentence} doit contenir au moins ${MIN_LOGIN_IDENTIFIER_LENGTH} caractères.`
  }

  if (
    data.mode === 'new' &&
    trimmedLoginIdentifier &&
    trimmedLoginIdentifier.toLowerCase() === (mainLoginIdentifier ?? '').trim().toLowerCase()
  ) {
    return `L'identifiant de connexion du compte ${target} doit être différent du vôtre.`
  }

  return null
}
