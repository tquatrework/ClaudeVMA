/**
 * Module API — mémo élève (pedagogical-log-service).
 *
 * Réécrit le 2026-08-27 (chantier `feat/memo-formules`) sur le contrat réel
 * documenté dans `docs/routes.md` § « Mémo élève — assaini le 2026-08-27 ».
 * L'ancien contrat (`POST/GET/PUT/DELETE /memos/:id`, modèle plat) n'a jamais
 * existé côté serveur — voir l'encadré « Constat de départ » de cette même
 * section : deux implémentations concurrentes coexistaient, la migration
 * réelle n'a jamais tourné en production. Ce module ne cible que les routes
 * réellement montées.
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'
import type {
  CreateMemoChapterPayload,
  CreateMemoTextOrFormulaItemPayload,
  MemoChapter,
  MemoChapterSummary,
  MemoImageItem,
  MemoItem,
  UpdateMemoChapterPayload,
  UpdateMemoItemPayload,
} from '../types/memo'

// ─── Lecture ────────────────────────────────────────────────────────────────

/**
 * GET /memos — mémo complet (chapitres + items) de l'élève connecté.
 * Réservé au rôle élève (route hardcodée sur `studentId = callerId`).
 */
export async function fetchMyMemo(): Promise<MemoChapter[]> {
  const { data } = await apiClient.get<MemoChapter[]>('/memos')
  return data
}

/**
 * GET /memos/search?q= — recherche textuelle dans les items du mémo de
 * l'élève connecté.
 */
export async function searchMemoItems(query: string): Promise<MemoItem[]> {
  const { data } = await apiClient.get<MemoItem[]>('/memos/search', { params: { q: query } })
  return data
}

/**
 * GET /memos/students/:studentId — route consolidée (contrat 2026-08-27,
 * point B6) : mémo complet d'un élève, pour le titulaire lui-même **ou** un
 * tiers relié (formateur, RP/AP coordinateur, parent financeur) ou un
 * administrateur (RP/AF/TI). Utilisée aussi bien pour la vue de lecture d'un
 * tiers que pour l'élève consultant son propre mémo (le serveur accepte les
 * deux, évite de dupliquer un chemin `fetchMyMemo` vs `fetchStudentMemo`).
 */
export async function fetchStudentMemo(studentId: string): Promise<MemoChapter[]> {
  const { data } = await apiClient.get<MemoChapter[]>(`/memos/students/${studentId}`)
  return data
}

/**
 * GET /memos/chapters/:chapterId — détail d'un chapitre et de ses items.
 */
export async function fetchMemoChapterDetail(chapterId: string): Promise<MemoChapter> {
  const { data } = await apiClient.get<MemoChapter>(`/memos/chapters/${chapterId}`)
  return data
}

// ─── Chapitres — écriture (élève titulaire uniquement) ─────────────────────────

/**
 * POST /memos/chapters — créer un chapitre. `400` si le plafond de 50
 * chapitres par élève est atteint.
 */
export async function createMemoChapter(
  payload: CreateMemoChapterPayload,
): Promise<MemoChapterSummary> {
  const { data } = await apiClient.post<MemoChapterSummary>('/memos/chapters', payload)
  return data
}

/**
 * PUT /memos/chapters/:chapterId — renommer/réordonner un chapitre (mise à
 * jour partielle). Le serveur ne renvoie pas les items sur cette route
 * d'écriture — la fusion avec les items déjà connus se fait côté appelant.
 */
export async function updateMemoChapter(
  chapterId: string,
  payload: UpdateMemoChapterPayload,
): Promise<MemoChapterSummary> {
  const { data } = await apiClient.put<MemoChapterSummary>(`/memos/chapters/${chapterId}`, payload)
  return data
}

/**
 * DELETE /memos/chapters/:chapterId — supprime le chapitre et ses items en
 * cascade (les fichiers image associés sont supprimés côté serveur).
 */
export async function deleteMemoChapter(chapterId: string): Promise<void> {
  await apiClient.delete(`/memos/chapters/${chapterId}`)
}

// ─── Items texte / formule — écriture (élève titulaire uniquement) ─────────────

/**
 * POST /memos/chapters/:chapterId/items — ajoute un item texte ou formule
 * (JSON). `type: "image"` est refusé ici (`400`) — voir `uploadMemoImageItem`.
 */
export async function createMemoTextOrFormulaItem(
  chapterId: string,
  payload: CreateMemoTextOrFormulaItemPayload,
): Promise<MemoItem> {
  const { data } = await apiClient.post<MemoItem>(`/memos/chapters/${chapterId}/items`, payload)
  return data
}

/**
 * PUT /memos/chapters/:chapterId/items/:itemId — modifie `content`/`order`.
 * Le type d'un item n'est jamais modifiable ; pour un item image, `content`
 * porte la légende (les octets ne se remplacent pas ici).
 */
export async function updateMemoItem(
  chapterId: string,
  itemId: string,
  payload: UpdateMemoItemPayload,
): Promise<MemoItem> {
  const { data } = await apiClient.put<MemoItem>(
    `/memos/chapters/${chapterId}/items/${itemId}`,
    payload,
  )
  return data
}

/** DELETE /memos/chapters/:chapterId/items/:itemId */
export async function deleteMemoItem(chapterId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/memos/chapters/${chapterId}/items/${itemId}`)
}

// ─── Item image ─────────────────────────────────────────────────────────────

/**
 * POST /memos/chapters/:chapterId/items/image — ajoute un item image
 * (multipart, champ `file`, `caption?`, `title?`, `order?`). **`Content-Type`
 * neutralisé** (`undefined`) pour que le navigateur pose lui-même l'en-tête
 * avec son `boundary` — même exigence que `uploadLogAttachment`.
 */
export async function uploadMemoImageItem(
  chapterId: string,
  file: File,
  caption?: string,
  title?: string,
  order?: number,
): Promise<MemoImageItem> {
  const formData = new FormData()
  formData.append('file', file)
  if (caption) formData.append('caption', caption)
  if (title) formData.append('title', title)
  if (order !== undefined) formData.append('order', String(order))

  const { data } = await apiClient.post<MemoImageItem>(
    `/memos/chapters/${chapterId}/items/image`,
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}

/**
 * GET /memos/chapters/:chapterId/items/:itemId/image — télécharge les octets
 * bruts d'un item image. Route authentifiée par le JWT de l'en-tête
 * `Authorization`, qu'une balise `<img src>` brute n'envoie pas : l'appelant
 * doit récupérer le blob puis construire un object URL (même pattern que
 * `fetchLogAttachmentBlob`).
 */
export async function fetchMemoItemImageBlob(chapterId: string, itemId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(
    `/memos/chapters/${chapterId}/items/${itemId}/image`,
    { responseType: 'blob' },
  )
  return data
}
