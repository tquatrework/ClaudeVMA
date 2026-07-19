import apiClient from './client'

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
