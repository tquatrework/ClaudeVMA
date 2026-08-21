/**
 * Module API — pedagogical-log-service (Phase 6)
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Refonte du 2026-08-20 : `eleve_formateur` est remplacé par `parent_formateur`
 * (le sens exact s'inverse — c'est désormais l'élève qui est exclu, pas le
 * parent). L'ancienne valeur est rejetée `400` par le serveur, elle ne doit plus
 * jamais être émise par le front.
 */
export type LogVisibility =
  | 'eleve_parent_formateur'
  | 'parent_formateur'
  | 'formateur_rp'
  | 'special'

export interface PedagogicalLogPage {
  id: string
  studentId: string
  authorId: string
  authorRole: string
  /**
   * Réservé aux pages spéciales du RP (`isSpecialPage: true`) depuis la refonte
   * du 2026-08-20. `null`/absent sur une entrée normale — voir `sessionSummary`
   * et `homework`.
   */
  content?: string | null
  /** Date de la séance, `YYYY-MM-DD`. Optionnelle — `null` si non renseignée. */
  date?: string | null
  /** « Déroulement de la séance ». Optionnel. */
  sessionSummary?: string | null
  /** « À faire ». Optionnel. */
  homework?: string | null
  visibility: LogVisibility
  isSpecialPage: boolean
  hiddenFromStudent: boolean
  /** Créée automatiquement à la confirmation d'un cours (`ActivityConfirmed`). */
  autoCreated?: boolean
  linkedResources?: string[]
  createdAt: string
  updatedAt?: string
}

/**
 * Corps de `POST`/`PATCH` pour une entrée normale — `date`/`sessionSummary`/
 * `homework` sont les trois champs de la refonte du 2026-08-20, tous
 * optionnels. `content` n'est pertinent que pour `PATCH` d'une **page
 * spéciale** RP (mécanisme inchangé, hors périmètre de cette refonte) — ne
 * jamais l'envoyer pour une entrée normale.
 */
export interface LogEntryPayload {
  date?: string
  sessionSummary?: string
  homework?: string
  visibility?: LogVisibility
  content?: string
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

export interface FetchStudentLogParams {
  /** Date calendaire ISO `YYYY-MM-DD`, filtre inclusif sur `date`. */
  from?: string
  to?: string
}

/**
 * Lit le cahier de texte d'un élève (filtré par rôle et visibilité côté serveur).
 * Triée du plus récent au plus ancien (par `date`, entrées sans date en dernier).
 *
 * Route : GET /students/:studentId/pedagogical-log
 *
 * Remplace l'ancien appel `GET /pedagogical-logs` (jamais monté côté contrôleur,
 * `404` réel — bug corrigé le 2026-08-20, voir `docs/routes.md`).
 */
export async function fetchStudentPedagogicalLog(
  studentId: string,
  params: FetchStudentLogParams = {},
): Promise<PedagogicalLogPage[]> {
  const { data } = await apiClient.get<PedagogicalLogPage[]>(
    `/students/${studentId}/pedagogical-log`,
    { params },
  )
  return data
}

/**
 * Crée une entrée de cahier de texte liée à un élève précis.
 * Réservé au formateur titulaire de la relation avec cet élève (RP retiré le 2026-08-20).
 * `studentId` est porté par le chemin, jamais par le corps.
 * Route : POST /students/:studentId/pedagogical-log
 */
export async function createStudentLogEntry(
  studentId: string,
  payload: LogEntryPayload,
): Promise<PedagogicalLogPage> {
  const { data } = await apiClient.post<PedagogicalLogPage>(
    `/students/${studentId}/pedagogical-log`,
    payload,
  )
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
 * Modifie une entrée de cahier de texte.
 * Entrée normale : formateur auteur, toujours titulaire de la relation, uniquement.
 * Page spéciale : auteur ou RP/TI (mécanisme inchangé).
 *
 * Route : PATCH /logs/:id — **la seule route atteignable depuis l'extérieur**
 * (`PUT /pedagogical-logs/:id` n'est jamais monté côté contrôleur, `404` réel).
 */
export async function updateLogEntry(
  logId: string,
  payload: LogEntryPayload,
): Promise<PedagogicalLogPage> {
  const { data } = await apiClient.patch<PedagogicalLogPage>(`/logs/${logId}`, payload)
  return data
}

/**
 * Supprime une entrée de cahier de texte.
 * Entrée normale : formateur auteur, toujours titulaire de la relation, uniquement.
 * Page spéciale : auteur ou RP.
 *
 * Route : DELETE /logs/:id — **la seule route atteignable depuis l'extérieur**
 * (`DELETE /pedagogical-logs/:id` n'est jamais monté côté contrôleur, `404` réel ;
 * `DELETE /:id` existe côté service mais n'est jamais proxié par la gateway).
 */
export async function deleteLogEntry(logId: string): Promise<void> {
  await apiClient.delete(`/logs/${logId}`)
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
