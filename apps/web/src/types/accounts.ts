/**
 * Types partagés — comptes et consentements (identity-access-service)
 */

export type AccountStatus = 'active' | 'suspended' | 'pending'

/** Types de consentement reconnus par identity-access-service (docs/routes.md). */
export type ConsentType = 'rgpd' | 'cgu' | 'marketing'

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

/**
 * Consentement recueilli par le formulaire d'inscription et transmis dans le corps
 * de la création de compte (voir docs/routes.md > `consents`).
 *
 * Une seule donnée, un seul nom : la forme est **strictement identique** à celle du
 * corps de `POST /consents` (`consentType`, `version` optionnelle, défaut `1.0`).
 * L'ancienne forme `{rgpd: true, cgu: true}` était silencieusement jetée par le
 * serveur et renvoie désormais `400`.
 */
export interface RegistrationConsent {
  consentType: ConsentType
  version?: string
}

/**
 * État des cases à cocher de l'étape « Consentements RGPD / CGU », partagé par les
 * wizards d'inscription élève et formateur. Converti en `RegistrationConsent[]` par
 * `buildRegistrationConsents` (src/utils/registrationConsents.ts) : seul ce que
 * l'utilisateur a réellement coché est transmis.
 */
export interface RegistrationConsentsFormData {
  hasAcceptedRgpd: boolean
  hasAcceptedCgu: boolean
}

export interface RegisterStudentPayload {
  email: string
  loginIdentifier?: string
  password: string
  firstName: string
  lastName: string
  phoneNumber?: string
  /**
   * Omis si l'utilisateur n'a rien coché. Le compte lié éventuellement créé dans le
   * même appel n'en reçoit jamais : un consentement est un acte personnel, il signe
   * les siens à sa première connexion (docs/routes.md).
   */
  consents?: RegistrationConsent[]
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
  consents?: RegistrationConsent[]
}

export interface ChangeAccountStatusPayload {
  status: AccountStatus
  reason: string
}

export interface RegenerateAccountAccessPayload {
  reason: string
}

export interface Consent {
  consentType: string
  signedAt: string
}
