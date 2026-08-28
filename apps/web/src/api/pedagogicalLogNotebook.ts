/**
 * Module API — carnet personnel (pedagogical-log-service).
 *
 * Carnet strictement privé, générique par titulaire (chantier de
 * généralisation, PR #140 côté pedagogical-log-service, 2026-08-27) : ouvert à
 * tout rôle authentifié, chacun ne voyant et n'écrivant strictement que le sien
 * — aucune exception, y compris pour les rôles administratifs.
 *
 * Contrat déplacé le 2026-08-27 : l'ancienne route `students/:studentId/notebook`
 * devient `pedagogical-logs/notebook`, sans `:studentId` dans l'URL — le
 * titulaire est déduit du JWT côté serveur. Le champ de réponse `studentId` est
 * renommé `ownerId`.
 *
 * Spécification fonctionnelle réelle — révisée le 2026-08-27 après retour
 * utilisateur sur les captures d'écran (docs/architecture.md, « Specification
 * fonctionnelle reelle du carnet personnel — notes rapides immuables ») :
 * ce sont des notes rapides horodatées automatiquement à la création, des
 * « pensées instantanées », strictement IMMUABLES une fois écrites —
 * suppression possible, AUCUNE édition. `updateNotebookEntry` est donc retiré
 * (la route `PATCH .../notebook/:id` n'existe plus côté serveur — `404` —
 * depuis la PR #144 pedagogical-log-service, contrat confirmé le 2026-08-27).
 *
 * Contrat de recherche réel (PR #144, transmis par le coordinateur) :
 * `GET /pedagogical-logs/notebook?from=&to=&q=`, tous optionnels et
 * combinables. `from`/`to` filtrent sur `createdAt` (plage) ; pour une date
 * précise, envoyer `from=to` (même valeur sur les deux). `q` fait une
 * recherche texte libre sur le contenu. Sans aucun paramètre, comportement
 * inchangé (tout renvoyé).
 *
 * Toutes les requêtes passent par apiClient (base /api/v1).
 */

import apiClient from './client'

export interface NotebookEntry {
  id: string
  ownerId: string
  content: string
  createdAt: string
}

export interface CreateNotebookEntryPayload {
  content: string
}

/**
 * Filtre de recherche optionnel — une pensée instantanée se retrouve par sa
 * date ou par un mot de son contenu, jamais en faisant défiler une liste
 * brute. Les trois peuvent être combinés (PR #144, pedagogical-log-service).
 */
export interface NotebookSearchParams {
  /** Borne basse de `createdAt` (ISO). Pour une date précise, égale à `to`. */
  from?: string
  /** Borne haute de `createdAt` (ISO). Pour une date précise, égale à `from`. */
  to?: string
  /** Recherche textuelle libre dans le contenu de la note. */
  q?: string
}

export async function fetchNotebookEntries(
  params?: NotebookSearchParams,
): Promise<NotebookEntry[]> {
  const { data } = await apiClient.get<NotebookEntry[]>('/pedagogical-logs/notebook', {
    params,
  })
  return data
}

export async function createNotebookEntry(
  payload: CreateNotebookEntryPayload,
): Promise<NotebookEntry> {
  const { data } = await apiClient.post<NotebookEntry>('/pedagogical-logs/notebook', payload)
  return data
}

export async function deleteNotebookEntry(entryId: string): Promise<void> {
  await apiClient.delete(`/pedagogical-logs/notebook/${entryId}`)
}
