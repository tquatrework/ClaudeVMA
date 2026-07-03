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
