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
