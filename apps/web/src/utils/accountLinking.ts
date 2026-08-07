/**
 * accountLinking — logique partagée pour lier un compte élève à un compte
 * parent financeur (ou l'inverse) directement lors de l'inscription, en
 * s'appuyant sur les champs optionnels de `POST /accounts/students` et
 * `POST /accounts/parents` (docs/routes.md).
 *
 * Utilisé par StudentRegistrationPage / ParentRegistrationPage (formulaire
 * d'inscription) ainsi que par LinkedAccountSection (composant de saisie).
 */

export type LinkedAccountRelation = 'parent' | 'student'

export type LinkedAccountMode = 'none' | 'existing' | 'new'

export interface LinkedAccountFormData {
  mode: LinkedAccountMode
  loginIdentifier: string
  email: string
  firstName: string
  lastName: string
  password: string
}

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
  parentLoginIdentifier?: string
  parentEmail?: string
  parentFirstName?: string
  parentLastName?: string
  parentPassword?: string
}

export interface StudentLinkFields {
  studentLoginIdentifier?: string
  studentEmail?: string
  studentFirstName?: string
  studentLastName?: string
  studentPassword?: string
}

const FIELD_KEYS: Record<
  LinkedAccountRelation,
  { loginIdentifier: string; email: string; firstName: string; lastName: string; password: string }
> = {
  parent: {
    loginIdentifier: 'parentLoginIdentifier',
    email: 'parentEmail',
    firstName: 'parentFirstName',
    lastName: 'parentLastName',
    password: 'parentPassword',
  },
  student: {
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
 *   ambiguïté, il n'y a alors rien d'autre à transmettre.
 * - Sinon, selon le mode choisi par l'utilisateur : rien (`none`), lien vers un
 *   compte existant (`existing`) ou création d'un nouveau compte lié (`new`).
 */
export function buildLinkedAccountFields(
  relation: LinkedAccountRelation,
  data: LinkedAccountFormData,
  lockedLoginIdentifier?: string | null,
): ParentLinkFields & StudentLinkFields {
  const keys = FIELD_KEYS[relation]

  if (lockedLoginIdentifier) {
    return { [keys.loginIdentifier]: lockedLoginIdentifier }
  }

  if (data.mode === 'existing' && data.loginIdentifier.trim()) {
    return { [keys.loginIdentifier]: data.loginIdentifier.trim() }
  }

  if (data.mode === 'new' && data.email.trim()) {
    return {
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
 */
export function validateLinkedAccountData(
  relation: LinkedAccountRelation,
  data: LinkedAccountFormData,
  lockedLoginIdentifier?: string | null,
): string | null {
  if (lockedLoginIdentifier) return null

  const { targetSentence } = LINKED_ACCOUNT_LABELS[relation]

  if (data.mode === 'existing' && !data.loginIdentifier.trim()) {
    return `Veuillez renseigner l'identifiant ${targetSentence} à lier, ou choisissez "Ne rien lier maintenant".`
  }

  if (data.mode === 'new' && (!data.email.trim() || !data.firstName.trim() || !data.lastName.trim())) {
    return `L'email, le prénom et le nom ${targetSentence} sont requis pour créer un nouveau compte lié.`
  }

  return null
}
