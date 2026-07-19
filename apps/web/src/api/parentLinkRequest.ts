import apiClient from './client'

export type ParentLinkRequestStatus = 'pending' | 'approved' | 'rejected'
export type ParentLinkRequestDirection = 'parent_initiated' | 'student_initiated'

export interface ParentLinkRequest {
  id: string
  parentId: string
  studentId: string
  status: ParentLinkRequestStatus
  direction: ParentLinkRequestDirection
  requestedAt: string
  processedAt?: string
  processedBy?: string
}

/** Parent invite un élève (direction: parent_initiated) */
export async function createParentLinkRequest(studentLoginIdentifier: string): Promise<ParentLinkRequest> {
  const { data } = await apiClient.post<ParentLinkRequest>('/parent-link-requests', { studentLoginIdentifier })
  return data
}

/** Élève invite son parent (direction: student_initiated) */
export async function createStudentInitiatedRequest(parentLoginIdentifier: string): Promise<ParentLinkRequest> {
  const { data } = await apiClient.post<ParentLinkRequest>('/parent-link-requests/student-initiated', {
    parentLoginIdentifier,
  })
  return data
}

export async function fetchParentLinkRequests(): Promise<ParentLinkRequest[]> {
  const { data } = await apiClient.get<ParentLinkRequest[]>('/parent-link-requests')
  return data
}

export async function approveParentLinkRequest(id: string): Promise<ParentLinkRequest> {
  const { data } = await apiClient.post<ParentLinkRequest>(`/parent-link-requests/${id}/approve`)
  return data
}

export async function rejectParentLinkRequest(id: string): Promise<ParentLinkRequest> {
  const { data } = await apiClient.post<ParentLinkRequest>(`/parent-link-requests/${id}/reject`)
  return data
}
