/**
 * Types partagés — Profil utilisateur (profile-service)
 * Partagés entre ProfilePage, ProfileEditPage, TeacherValidationPanel, etc.
 */

export interface Profile {
  userId: string
  loginIdentifier?: string | null
  administrativeProfile?: Record<string, unknown>
  pedagogicalProfile?: Record<string, unknown>
}

export interface InternalNote {
  id: string
  authorId: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface TeacherStudentRelation {
  teacherId: string
  studentId: string
  isPrincipalTeacher?: boolean
  createdAt?: string
}

export interface CoordinatorRelation {
  coordinatorId: string
  studentId: string
  coordinatorRole: string
}

/**
 * Champs du profil administratif — utilisés par ProfileEditPage pour typer le
 * formulaire (au lieu de `Profile.administrativeProfile: Record<string, unknown>`,
 * gardé générique pour l'affichage en lecture seule sur ProfilePage).
 */
export interface AdministrativeProfileFields {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
}

/**
 * Champs du profil pédagogique — utilisés par ProfileEditPage.
 */
export interface PedagogicalProfileFields {
  level?: string
  subjects?: string
  goals?: string
  notes?: string
}

/**
 * Statistiques pédagogiques d'un utilisateur (ProfileStatisticsPanel).
 * Écart : `GET /profiles/:userId/statistics` n'apparaît pas dans docs/routes.md.
 */
export interface PedagogicalStatistics {
  totalSessionsAttended?: number
  totalHoursLearned?: number
  averageSessionDurationMinutes?: number
  lastSessionDate?: string
  subjectsStudied?: string[]
  currentLevel?: string
  progressScore?: number
}

/**
 * Préférences de confidentialité d'un élève (ProfileVisibilitySettingsPage).
 * Écart : `GET/PATCH /profiles/:userId/visibility-preferences` n'apparaissent pas
 * dans docs/routes.md.
 */
export interface VisibilityPreferences {
  showEmailToTeachers: boolean
  showPhoneToTeachers: boolean
  showAddressToTeachers: boolean
  showProgressToParents: boolean
  showCalendarToParents: boolean
}

/**
 * Statut de validation d'un formateur (TeacherValidationPanel, RP/TI uniquement).
 * Écart : `GET/PATCH /profiles/:teacherId/validation` n'apparaissent pas dans
 * docs/routes.md (seul `POST /profiles/:teacherId/ap-status` y est documenté).
 */
export interface TeacherValidationStatus {
  teacherId: string
  validationStatus: 'pending' | 'in_review' | 'validated' | 'rejected'
  validatedAt?: string
  validatedBy?: string
  rejectionReason?: string
}

export interface UpdateTeacherValidationPayload {
  validationStatus: 'in_review' | 'validated' | 'rejected'
  rejectionReason?: string
}
