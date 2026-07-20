import apiClient from './client'
import type { TeacherStudentRelation } from '../types/profile'

export interface FinanceOwnerStudentLink {
  financeOwnerId: string
  studentId: string
  createdAt: string
}

export interface StudentProfile {
  userId: string
  loginIdentifier: string | null
  administrativeProfile?: {
    firstName?: string
    lastName?: string
  }
  pedagogicalProfile?: {
    level?: string
    grade?: string
    schoolYear?: string
  }
}

export async function fetchLinkedStudents(financeOwnerId: string): Promise<FinanceOwnerStudentLink[]> {
  const { data } = await apiClient.get<FinanceOwnerStudentLink[]>(
    `/relations/finance-owner-student/${financeOwnerId}`,
  )
  return data
}

/** Lister les parents financeurs rattachés à un élève */
export async function fetchLinkedParents(studentId: string): Promise<FinanceOwnerStudentLink[]> {
  const { data } = await apiClient.get<FinanceOwnerStudentLink[]>(
    `/relations/finance-owner-student/by-student/${studentId}`,
  )
  return data
}

export async function fetchStudentProfile(studentId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<StudentProfile>(`/profiles/${studentId}`)
  return data
}

/**
 * GET /relations/teacher-student/:studentId — Lister les formateurs liés à un élève
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md, qui documente uniquement
 * `POST /relations/teacher-student`. Reproduite ici à l'identique du comportement
 * préexistant — non corrigée dans ce lot structurel.
 */
export async function fetchTeacherStudentRelations(
  studentId: string,
): Promise<TeacherStudentRelation[]> {
  const { data } = await apiClient.get<TeacherStudentRelation[]>(
    `/relations/teacher-student/${studentId}`,
  )
  return data
}
