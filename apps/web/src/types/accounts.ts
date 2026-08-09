/**
 * Types partagés — comptes et consentements (identity-access-service)
 */

export type AccountStatus = 'active' | 'suspended' | 'pending'

export interface CheckEmailAvailabilityResult {
  alreadyUsed: boolean
  suggestedLoginIdentifier: string
}

/**
 * Intention de liaison déclarée lors d'une inscription (voir docs/routes.md,
 * `parentAccountMode` / `studentAccountMode`) :
 * - `none`    : aucun compte lié (le serveur refuse alors tout champ `parent*`/`student*`) ;
 * - `existing`: rattacher un compte déjà existant, désigné par son identifiant de connexion ;
 * - `new`     : créer le compte lié, avec l'identifiant de connexion choisi ici.
 *
 * L'intention n'est jamais devinée par le serveur : ce mode est obligatoire dès
 * qu'un champ de liaison est transmis.
 */
export type LinkedAccountMode = 'none' | 'existing' | 'new'

/** Nature du compte lié à celui en cours de création. */
export type LinkedAccountRelation = 'parent' | 'student'

/** État de saisie du bloc « lier un compte » des pages d'inscription. */
export interface LinkedAccountFormData {
  mode: LinkedAccountMode
  /**
   * Identifiant de connexion du compte lié. Une seule donnée, un seul nom :
   * en mode `existing` il désigne le compte à rattacher, en mode `new` il nomme
   * le compte créé — c'est avec lui que ce compte se connectera.
   */
  loginIdentifier: string
  email: string
  firstName: string
  lastName: string
  password: string
}

export interface RegisterParentPayload {
  email: string
  loginIdentifier?: string
  password: string
  firstName: string
  lastName: string
  // Liaison optionnelle à un élève, dans le même appel POST /accounts/parents
  // (voir docs/routes.md). `studentAccountMode` déclare l'intention ; il est
  // obligatoire dès qu'un champ `student*` est transmis, sans quoi le serveur
  // répond 400. `studentLoginIdentifier` désigne le compte à rattacher
  // (`existing`) ou nomme le compte créé (`new`).
  studentAccountMode?: LinkedAccountMode
  studentLoginIdentifier?: string
  studentEmail?: string
  studentPassword?: string
  studentFirstName?: string
  studentLastName?: string
}

export interface RegistrationConsents {
  rgpd: boolean
  cgu: boolean
}

export interface RegisterStudentPayload {
  email: string
  loginIdentifier?: string
  password: string
  firstName: string
  lastName: string
  birthDate?: string
  phoneNumber?: string
  consents: RegistrationConsents
  // Liaison optionnelle à un parent financeur, dans le même appel
  // POST /accounts/students (voir docs/routes.md). `parentAccountMode` déclare
  // l'intention ; il est obligatoire dès qu'un champ `parent*` est transmis, sans
  // quoi le serveur répond 400. `parentLoginIdentifier` désigne le compte à
  // rattacher (`existing`) ou nomme le compte créé (`new`).
  parentAccountMode?: LinkedAccountMode
  parentLoginIdentifier?: string
  parentEmail?: string
  parentPassword?: string
  parentFirstName?: string
  parentLastName?: string
}

export interface RegisterTeacherPayload {
  email: string
  loginIdentifier?: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
  teachingSubjects?: string
  educationLevel?: string
  bio?: string
  consents: RegistrationConsents
}

export interface ChangeAccountStatusPayload {
  status: AccountStatus
  reason: string
}

export interface RegenerateAccountAccessPayload {
  reason: string
}

export type ConsentType = 'rgpd' | 'cgu' | 'marketing'

export interface Consent {
  consentType: string
  signedAt: string
}
