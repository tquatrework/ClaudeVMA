/**
 * Module API — archive-document-service
 * Archives pédagogiques chronologiques et liens durables.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * ⚠️ Contrat aligné le 2026-08-11 sur la pile réelle (https://claudevma.visioprof.fr),
 * après avoir relevé trois écarts qui laissaient l'écran vide alors que le serveur
 * répondait `200` :
 *   1. la liste renvoie une **enveloppe paginée** `{data, page, limit, total, totalPages}`,
 *      pas un tableau nu — le repli `Array.isArray(data) ? data : []` transformait
 *      silencieusement une réponse valide en « aucune archive » ;
 *   2. les cinq `itemType` déclarés ici (`pedagogical_log`, `course_summary`,
 *      `notebook_entry`, `recording`, `content_catalog`) **n'ont jamais existé** côté
 *      serveur ; les valeurs réelles sont celles ci-dessous ;
 *   3. le champ de visibilité parent s'appelle `isParentVisible`, jamais
 *      `isAccessibleToFinanceOwner`.
 * `sourceUrl` n'existe pas non plus dans la réponse : seul `downloadUrl` est renvoyé.
 *
 * Droit d'accès : piloté par la relation métier, contrôlé par le serveur. Un refus
 * répond `404` avec le **même message** qu'une absence d'archive — les deux cas sont
 * volontairement indiscernables. Les appelants traitent donc `404` comme « rien à
 * afficher », et surtout pas comme une erreur technique ; en revanche `503`
 * (profile-service injoignable) et les autres statuts restent de vraies erreurs.
 */

import apiClient from './client'
import type { PaginatedResponse } from '../types/pagination'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Valeurs réellement renvoyées par le serveur (docs/routes.md § archive-document-service). */
export type ArchiveItemType =
  | 'cahier_de_texte'
  | 'carnet_personnel'
  | 'resume_de_cours'
  | 'contenu_eleve'
  | 'parcours'
  | 'exercice_evaluation'
  | 'video'

/**
 * Enveloppe de pagination commune aux deux routes de lecture — même forme que
 * celle des autres listes bornées du projet, d'où le type partagé.
 */
export type PaginatedArchiveResponse<T> = PaginatedResponse<T>

export interface PedagogicalArchiveItem {
  id: string
  /** Titulaire de l'archive : un élève, ou un formateur quand un AP le consulte. */
  studentId: string
  itemType: ArchiveItemType
  sourceId: string
  sourceService: string
  title: string
  description: string | null
  downloadUrl: string | null
  score: number | null
  pedagogicalPoints: number
  occurredAt: string
  /** Nom serveur du drapeau de visibilité parent — pas `isAccessibleToFinanceOwner`. */
  isParentVisible: boolean
  idempotencyKey: string | null
  createdAt: string
  updatedAt: string
}

/** Élément allégé de la timeline : pas de description ni de lien de téléchargement. */
export interface ArchiveTimelineItem {
  id: string
  itemType: ArchiveItemType
  title: string
  sourceId: string
  sourceService: string
  score: number | null
  pedagogicalPoints: number
}

/** La timeline est **groupée par date** côté serveur (`date` au format `YYYY-MM-DD`). */
export interface ArchiveTimelineGroup {
  date: string
  items: ArchiveTimelineItem[]
}

export interface CreateArchiveLinkPayload {
  itemType: ArchiveItemType
  title: string
  /** Identifiant de la ressource dans le service source — obligatoire (400 sinon). */
  sourceId: string
  /** Service d'origine, ex. `pedagogical-log-service` — obligatoire (400 sinon). */
  sourceService: string
  occurredAt: string
  description?: string
  downloadUrl?: string
  isParentVisible?: boolean
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * GET /archives/students/:userId/pedagogical-archives
 * Liste paginée des archives pédagogiques d'un titulaire.
 * Le droit vient de la relation, il est contrôlé par le serveur.
 */
export async function fetchPedagogicalArchives(
  userId: string,
): Promise<PaginatedArchiveResponse<PedagogicalArchiveItem>> {
  const { data } = await apiClient.get<PaginatedArchiveResponse<PedagogicalArchiveItem>>(
    `/archives/students/${userId}/pedagogical-archives`,
  )
  return data
}

/**
 * GET /archives/students/:userId/archive-timeline
 * Timeline chronologique groupée par date.
 */
export async function fetchArchiveTimeline(
  userId: string,
): Promise<PaginatedArchiveResponse<ArchiveTimelineGroup>> {
  const { data } = await apiClient.get<PaginatedArchiveResponse<ArchiveTimelineGroup>>(
    `/archives/students/${userId}/archive-timeline`,
  )
  return data
}

/**
 * POST /archives/students/:userId/archive-links
 * Crée un lien d'archive manuel. Une relation ouvre la lecture, jamais l'écriture :
 * cette route est réservée aux rôles formateur, AP, RP, TI, AF.
 */
export async function createArchiveLink(
  userId: string,
  payload: CreateArchiveLinkPayload,
): Promise<PedagogicalArchiveItem> {
  const { data } = await apiClient.post<PedagogicalArchiveItem>(
    `/archives/students/${userId}/archive-links`,
    payload,
  )
  return data
}

/**
 * GET /documents/:id/download
 * Télécharge un document d'archive (le serveur redirige vers le service source).
 */
export async function downloadArchiveDocument(documentId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  return data
}
