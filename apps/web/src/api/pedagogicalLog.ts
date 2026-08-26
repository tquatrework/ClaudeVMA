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
 *
 * Aucun champ dédié aux liens : un lien s'insère directement dans le texte
 * de `sessionSummary`/`homework` via la syntaxe légère `[texte](url)`
 * (`src/utils/lightMarkup.ts`) — l'ancien `resourceLinks` structuré a été
 * retiré le 2026-08-26 après retour utilisateur réel (le lien doit vivre
 * dans le texte, pas à côté).
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

// Mémo élève et carnet personnel : extraits dans `pedagogicalLogMemos.ts` et
// `pedagogicalLogNotebook.ts` (chantier « Liens et pièces jointes »,
// 2026-08-26) — sous-domaines indépendants du cahier de texte, pour rester
// sous le seuil de 300 lignes par fichier.
