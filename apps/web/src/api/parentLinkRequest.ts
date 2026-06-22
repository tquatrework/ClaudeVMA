import apiClient from './client'

export type ParentLinkRequestStatus = 'pending' | 'approved' | 'rejected'

export interface ParentLinkRequest {
  id: string
  parentId: string
  studentId: string
  status: ParentLinkRequestStatus
  requestedAt: string
  processedAt?: string
  processedBy?: string
}

export async function createParentLinkRequest(studentId: string): Promise<ParentLinkRequest> {
  const { data } = await apiClient.post<ParentLinkRequest>('/parent-link-requests', { studentId })
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
