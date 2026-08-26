/**
 * Module API — mémo élève (pedagogical-log-service).
 *
 * Extrait de `pedagogicalLog.ts` (chantier « Liens et pièces jointes »,
 * 2026-08-26) pour rester sous le seuil de 300 lignes par fichier : le mémo
 * élève est un sous-domaine indépendant du cahier de texte (outil personnel
 * de l'élève, pas un document pédagogique partagé).
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

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
