/**
 * Module API — carnet personnel de l'élève (pedagogical-log-service).
 *
 * Extrait de `pedagogicalLog.ts` (chantier « Liens et pièces jointes »,
 * 2026-08-26) pour rester sous le seuil de 300 lignes par fichier : le
 * carnet personnel est un espace strictement réservé à l'élève, distinct du
 * cahier de texte partagé (RP retiré en Phase 1, parent financeur jamais
 * autorisé — PLOG-FB-001).
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

export interface NotebookEntry {
  id: string
  studentId: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface CreateNotebookEntryPayload {
  content: string
}

export interface UpdateNotebookEntryPayload {
  content: string
}

export async function fetchNotebookEntries(studentId: string): Promise<NotebookEntry[]> {
  const { data } = await apiClient.get<NotebookEntry[]>(`/students/${studentId}/notebook`)
  return data
}

export async function createNotebookEntry(
  studentId: string,
  payload: CreateNotebookEntryPayload,
): Promise<NotebookEntry> {
  const { data } = await apiClient.post<NotebookEntry>(
    `/students/${studentId}/notebook`,
    payload,
  )
  return data
}

export async function updateNotebookEntry(
  studentId: string,
  entryId: string,
  payload: UpdateNotebookEntryPayload,
): Promise<NotebookEntry> {
  const { data } = await apiClient.patch<NotebookEntry>(
    `/students/${studentId}/notebook/${entryId}`,
    payload,
  )
  return data
}

export async function deleteNotebookEntry(studentId: string, entryId: string): Promise<void> {
  await apiClient.delete(`/students/${studentId}/notebook/${entryId}`)
}
