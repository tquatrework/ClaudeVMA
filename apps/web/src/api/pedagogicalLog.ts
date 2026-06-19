/**
 * Module API — pedagogical-log-service (Phase 6)
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogVisibility =
  | 'eleve_parent_formateur'
  | 'eleve_formateur'
  | 'formateur_rp'
  | 'special'

export interface PedagogicalLogPage {
  id: string
  studentId: string
  authorId: string
  authorRole: string
  content: string
  visibility: LogVisibility
  isSpecialPage: boolean
  hiddenFromStudent: boolean
  linkedResources?: string[]
  createdAt: string
  updatedAt?: string
}

export interface CreateLogPagePayload {
  content: string
  visibility?: LogVisibility
  sessionId?: string
}

export interface CreateSpecialPagePayload {
  content: string
  hiddenFromStudent: boolean
}

export type MemoItemType = 'text' | 'formula' | 'image'

export interface MemoItem {
  id: string
  chapterId: string
  itemType: MemoItemType
  content: string
  createdAt: string
}

export interface MemoChapter {
  id: string
  title: string
  items: MemoItem[]
  createdAt: string
}

export interface CreateChapterPayload {
  title: string
}

export interface CreateMemoItemPayload {
  itemType: MemoItemType
  content: string
}

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

// ─── Cahier de texte ──────────────────────────────────────────────────────────

/**
 * Liste les entrées du cahier de texte.
 * Le filtrage par rôle et visibilité est effectué côté serveur.
 * Route : GET /pedagogical-logs
 */
export async function fetchPedagogicalLogs(): Promise<PedagogicalLogPage[]> {
  const { data } = await apiClient.get<PedagogicalLogPage[]>('/pedagogical-logs')
  return data
}

/**
 * Crée une entrée de cahier de texte.
 * Autorisé uniquement pour formateur et responsable_pedagogique.
 * Route : POST /pedagogical-logs
 */
export async function createLogPage(
  payload: CreateLogPagePayload,
): Promise<PedagogicalLogPage> {
  const { data } = await apiClient.post<PedagogicalLogPage>('/pedagogical-logs', payload)
  return data
}

/**
 * Crée une page spéciale avec visibilité ciblée (RP uniquement).
 * Route : POST /students/:studentId/pedagogical-log/special-pages
 */
export async function createSpecialLogPage(
  studentId: string,
  payload: CreateSpecialPagePayload,
): Promise<PedagogicalLogPage> {
  const { data } = await apiClient.post<PedagogicalLogPage>(
    `/students/${studentId}/pedagogical-log/special-pages`,
    payload,
  )
  return data
}

/**
 * Modifie une entrée de cahier de texte (auteur uniquement).
 * Route : PUT /pedagogical-logs/:id
 */
export async function updateLogPage(
  logId: string,
  content: string,
): Promise<PedagogicalLogPage> {
  const { data } = await apiClient.put<PedagogicalLogPage>(`/pedagogical-logs/${logId}`, { content })
  return data
}

/**
 * Supprime une entrée de cahier de texte (auteur ou RP).
 * Route : DELETE /pedagogical-logs/:id
 */
export async function deleteLogPage(logId: string): Promise<void> {
  await apiClient.delete(`/pedagogical-logs/${logId}`)
}

// ─── Mémo élève ───────────────────────────────────────────────────────────────

/**
 * Liste les mémos de l'élève connecté.
 * Route : GET /memos — élève uniquement.
 */
export async function fetchMemoChapters(): Promise<MemoChapter[]> {
  const { data } = await apiClient.get<MemoChapter[]>('/memos')
  return data
}

/**
 * Recherche dans les mémos de l'élève.
 * Route : GET /memos/search?q=
 */
export async function searchMemoItems(query: string): Promise<MemoItem[]> {
  const { data } = await apiClient.get<MemoItem[]>(`/memos/search`, { params: { q: query } })
  return data
}

/**
 * Crée un chapitre de mémo.
 * Route : POST /memos/chapters — élève uniquement.
 */
export async function createMemoChapter(payload: CreateChapterPayload): Promise<MemoChapter> {
  const { data } = await apiClient.post<MemoChapter>('/memos/chapters', payload)
  return data
}

/**
 * Ajoute un item dans un chapitre de mémo.
 * Route : POST /memos/chapters/:chapterId/items — élève uniquement.
 */
export async function createMemoItem(
  chapterId: string,
  payload: CreateMemoItemPayload,
): Promise<MemoItem> {
  const { data } = await apiClient.post<MemoItem>(
    `/memos/chapters/${chapterId}/items`,
    payload,
  )
  return data
}

/**
 * Modifie un mémo (élève propriétaire uniquement).
 * Route : PUT /memos/:id
 */
export async function updateMemo(memoId: string, content: string): Promise<MemoChapter> {
  const { data } = await apiClient.put<MemoChapter>(`/memos/${memoId}`, { content })
  return data
}

/**
 * Supprime un mémo (élève propriétaire uniquement).
 * Route : DELETE /memos/:id
 */
export async function deleteMemo(memoId: string): Promise<void> {
  await apiClient.delete(`/memos/${memoId}`)
}

// ─── Carnet personnel ─────────────────────────────────────────────────────────

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
