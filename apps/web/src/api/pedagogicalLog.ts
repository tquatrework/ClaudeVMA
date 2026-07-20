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

export interface Memo {
  id: string
  title: string
  content: string
  chapterId: string | null
  createdAt: string
  updatedAt?: string
}

export interface MemoChapter {
  id: string
  title: string
  studentId?: string
  createdAt: string
}

export interface CreateChapterPayload {
  title: string
}

export interface CreateMemoPayload {
  title: string
  content: string
  chapterId?: string | null
}

export interface UpdateMemoPayload {
  title?: string
  content?: string
  chapterId?: string | null
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

/**
 * Liste les logs d'une séance (cahier de texte lié à une activité).
 * Route : GET /logs/session/:sessionId
 * Utilisé par ActivityDetailPage (chargement non bloquant).
 */
export async function fetchSessionLogs(sessionId: string): Promise<PedagogicalLogPage[]> {
  const { data } = await apiClient.get<PedagogicalLogPage[]>(`/logs/session/${sessionId}`)
  return Array.isArray(data) ? data : []
}

// ─── Mémo élève ───────────────────────────────────────────────────────────────

/**
 * Liste les mémos de l'élève connecté.
 * Route : GET /memos — élève uniquement.
 */
export async function fetchMemos(): Promise<Memo[]> {
  const { data } = await apiClient.get<Memo[]>('/memos')
  return data
}

/**
 * Liste les chapitres de mémo de l'élève connecté.
 * Route : GET /memos/chapters — élève uniquement.
 */
export async function fetchMemoChapters(): Promise<MemoChapter[]> {
  const { data } = await apiClient.get<MemoChapter[]>('/memos/chapters')
  return data
}

/**
 * Recherche dans les mémos de l'élève.
 * Route : GET /memos/search?q=
 */
export async function searchMemos(query: string): Promise<Memo[]> {
  const { data } = await apiClient.get<Memo[]>(`/memos/search`, { params: { q: query } })
  return data
}

/**
 * Crée un mémo (avec ou sans chapitre).
 * Route : POST /memos — élève uniquement.
 */
export async function createMemo(payload: CreateMemoPayload): Promise<Memo> {
  const { data } = await apiClient.post<Memo>('/memos', payload)
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
 * Modifie un mémo (élève propriétaire uniquement).
 * Route : PUT /memos/:id
 */
export async function updateMemo(memoId: string, payload: UpdateMemoPayload): Promise<Memo> {
  const { data } = await apiClient.put<Memo>(`/memos/${memoId}`, payload)
  return data
}

/**
 * Supprime un mémo (élève propriétaire uniquement).
 * Route : DELETE /memos/:id
 */
export async function deleteMemo(memoId: string): Promise<void> {
  await apiClient.delete(`/memos/${memoId}`)
}

/**
 * Lit un mémo individuel par identifiant.
 * Autorisé pour : élève (propriétaire), formateur lié, RP, AP.
 * Route : GET /memos/:id
 */
export async function fetchMemoById(memoId: string): Promise<Memo> {
  const { data } = await apiClient.get<Memo>(`/memos/${memoId}`)
  return data
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
