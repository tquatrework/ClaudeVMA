/**
 * Types partagés — comptes et consentements (identity-access-service)
 */

export type AccountStatus = 'active' | 'suspended' | 'pending'

export interface CheckEmailAvailabilityResult {
  alreadyUsed: boolean
  suggestedLoginIdentifier: string
}

export interface RegisterParentPayload {
  email: string
  loginIdentifier?: string
  password: string
  firstName: string
  lastName: string
  // Liaison optionnelle à un élève, dans le même appel POST /accounts/parents
  // (voir docs/routes.md). `studentLoginIdentifier` lie un compte élève existant ;
  // `studentEmail`+`studentFirstName`+`studentLastName` (+`studentPassword` optionnel)
  // résout par email (crée ou lie selon le nombre de comptes trouvés).
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
  // POST /accounts/students (voir docs/routes.md). `parentLoginIdentifier` lie un
  // compte parent existant ; `parentEmail`+`parentFirstName`+`parentLastName`
  // (+`parentPassword` optionnel) résout par email (crée ou lie selon le nombre
  // de comptes trouvés).
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
