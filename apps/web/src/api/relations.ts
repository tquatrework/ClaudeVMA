import apiClient from './client'

export interface FinanceOwnerStudentLink {
  financeOwnerId: string
  studentId: string
  createdAt: string
}

export interface StudentProfile {
  userId: string
  administrativeProfile?: {
    firstName?: string
    lastName?: string
  }
}

export async function fetchLinkedStudents(financeOwnerId: string): Promise<FinanceOwnerStudentLink[]> {
  const { data } = await apiClient.get<FinanceOwnerStudentLink[]>(
    `/relations/finance-owner-student/${financeOwnerId}`,
  )
  return data
}

export async function fetchStudentProfile(studentId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<StudentProfile>(`/profiles/${studentId}`)
  return data
}
