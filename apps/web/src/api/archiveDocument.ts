/**
 * Module API — archive-document-service (Phase 11)
 * Archives pédagogiques chronologiques et liens durables.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArchiveItemType =
  | 'pedagogical_log'
  | 'course_summary'
  | 'notebook_entry'
  | 'recording'
  | 'content_catalog'

export interface PedagogicalArchiveItem {
  id: string
  studentId: string
  itemType: ArchiveItemType
  title: string
  description?: string
  sourceUrl?: string
  downloadUrl?: string
  occurredAt: string
  createdAt: string
  isAccessibleToFinanceOwner: boolean
}

export interface ArchiveTimelineEntry {
  id: string
  studentId: string
  itemType: ArchiveItemType
  title: string
  description?: string
  occurredAt: string
  sourceUrl?: string
  downloadUrl?: string
  isAccessibleToFinanceOwner: boolean
}

export interface CreateArchiveLinkPayload {
  itemType: ArchiveItemType
  title: string
  description?: string
  sourceUrl?: string
  occurredAt: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * GET /students/:studentId/pedagogical-archives
 * Liste les archives pédagogiques d'un élève.
 * Rôles autorisés : élève (propriétaire), formateur (liés), parent (liés — hors carnet personnel),
 * RP, AP, TI
 */
export async function fetchPedagogicalArchives(
  studentId: string,
): Promise<PedagogicalArchiveItem[]> {
  const { data } = await apiClient.get<PedagogicalArchiveItem[]>(
    `/archives/students/${studentId}/pedagogical-archives`,
  )
  return Array.isArray(data) ? data : []
}

/**
 * POST /students/:studentId/archive-links
 * Crée un lien d'archive manuel (rattache un document externe à l'historique).
 * Rôles autorisés : formateur, RP, AP, TI
 */
export async function createArchiveLink(
  studentId: string,
  payload: CreateArchiveLinkPayload,
): Promise<PedagogicalArchiveItem> {
  const { data } = await apiClient.post<PedagogicalArchiveItem>(
    `/archives/students/${studentId}/archive-links`,
    payload,
  )
  return data
}

/**
 * GET /students/:studentId/archive-timeline
 * Timeline chronologique des archives d'un élève.
 * Rôles autorisés : élève, formateur, parent (hors carnet personnel), RP, AP, TI
 */
export async function fetchArchiveTimeline(
  studentId: string,
): Promise<ArchiveTimelineEntry[]> {
  const { data } = await apiClient.get<ArchiveTimelineEntry[]>(
    `/archives/students/${studentId}/archive-timeline`,
  )
  return Array.isArray(data) ? data : []
}

/**
 * GET /documents/:id/download
 * Télécharge un document d'archive (retourne un blob).
 */
export async function downloadArchiveDocument(documentId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  return data
}
