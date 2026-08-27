/**
 * Module API — carnet personnel (pedagogical-log-service).
 *
 * Carnet strictement privé, désormais générique par titulaire (chantier de
 * généralisation, PR #140 côté pedagogical-log-service, 2026-08-27) : ouvert à
 * tout rôle authentifié, chacun ne voyant et n'écrivant strictement que le sien
 * — aucune exception, y compris pour les rôles administratifs.
 *
 * Contrat déplacé le 2026-08-27 : l'ancienne route `students/:studentId/notebook`
 * devient `pedagogical-logs/notebook`, sans `:studentId` dans l'URL — le
 * titulaire est déduit du JWT côté serveur. Le champ de réponse `studentId` est
 * renommé `ownerId`.
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

export interface NotebookEntry {
  id: string
  ownerId: string
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

export async function fetchNotebookEntries(): Promise<NotebookEntry[]> {
  const { data } = await apiClient.get<NotebookEntry[]>('/pedagogical-logs/notebook')
  return data
}

export async function createNotebookEntry(
  payload: CreateNotebookEntryPayload,
): Promise<NotebookEntry> {
  const { data } = await apiClient.post<NotebookEntry>('/pedagogical-logs/notebook', payload)
  return data
}

export async function updateNotebookEntry(
  entryId: string,
  payload: UpdateNotebookEntryPayload,
): Promise<NotebookEntry> {
  const { data } = await apiClient.patch<NotebookEntry>(
    `/pedagogical-logs/notebook/${entryId}`,
    payload,
  )
  return data
}

export async function deleteNotebookEntry(entryId: string): Promise<void> {
  await apiClient.delete(`/pedagogical-logs/notebook/${entryId}`)
}
