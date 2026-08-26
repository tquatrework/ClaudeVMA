/**
 * Module API — pièces jointes du cahier de texte (pedagogical-log-service).
 *
 * Extrait de `pedagogicalLog.ts` (chantier « Liens et pièces jointes »,
 * 2026-08-26) pour rester sous le seuil de 300 lignes par fichier : ce sont
 * des routes d'un sous-domaine distinct (fichiers), avec leur propre logique
 * d'upload multipart et de téléchargement authentifié.
 *
 * Toutes les requêtes passent par `apiClient` (base `/api/v1`). Chemins tels
 * que documentés dans `docs/routes.md` § « Liens et pièces jointes » — sous le
 * préfixe `/logs` (pièces jointes) et `/pedagogical-logs` (réglages système),
 * tous deux déjà proxifiés par api-gateway.
 */

import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Une pièce jointe d'entrée de cahier de texte.
 *
 * `storedFilename` est **typé mais ne doit jamais être affiché** : c'est le nom
 * de fichier généré côté serveur, un identifiant technique au même titre qu'un
 * UUID (règle du 2026-08-09). Seul `originalFilename` est montré à l'écran.
 */
export interface PedagogicalLogAttachment {
  id: string
  logEntryId: string
  originalFilename: string
  storedFilename: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  createdAt: string
}

/** Réglages système des pièces jointes — `GET`/`PATCH /pedagogical-logs/settings/attachments`. */
export interface PedagogicalLogAttachmentSettings {
  id: string
  attachmentsEnabled: boolean
  /** Plafond par fichier, en octets. */
  maxFileBytes: number
  /** Plafond total par entrée, en octets. */
  maxTotalBytesPerEntry: number
  updatedAt: string
}

/** Mise à jour partielle — n'envoyer que les champs réellement modifiés. */
export interface UpdateAttachmentSettingsPayload {
  attachmentsEnabled?: boolean
  maxFileBytes?: number
  maxTotalBytesPerEntry?: number
}

// ─── Réglages système ─────────────────────────────────────────────────────────

/**
 * GET /pedagogical-logs/settings/attachments — réglages courants.
 *
 * Ouvert à tout compte authentifié : le formateur doit pouvoir lire le
 * plafond et l'état activé/désactivé **avant** d'afficher le bouton « Joindre
 * un fichier », même discipline que `GET /profiles/avatar/constraints`.
 */
export async function fetchAttachmentSettings(): Promise<PedagogicalLogAttachmentSettings> {
  const { data } = await apiClient.get<PedagogicalLogAttachmentSettings>(
    '/pedagogical-logs/settings/attachments',
  )
  return data
}

/**
 * PATCH /pedagogical-logs/settings/attachments — technicien_informatique seul.
 *
 * Mise à jour **partielle** : seuls les champs présents dans `payload` sont
 * modifiés. Renvoie la réponse du serveur (jamais le corps envoyé) — règle du
 * 2026-08-10, point 3bis.
 */
export async function updateAttachmentSettings(
  payload: UpdateAttachmentSettingsPayload,
): Promise<PedagogicalLogAttachmentSettings> {
  const { data } = await apiClient.patch<PedagogicalLogAttachmentSettings>(
    '/pedagogical-logs/settings/attachments',
    payload,
  )
  return data
}

// ─── Pièces jointes d'une entrée ────────────────────────────────────────────────

/**
 * GET /logs/:id/attachments — mêmes droits de lecture que l'entrée elle-même
 * (filtrage par `visibility`, appliqué côté serveur).
 */
export async function fetchLogAttachments(logId: string): Promise<PedagogicalLogAttachment[]> {
  const { data } = await apiClient.get<PedagogicalLogAttachment[]>(`/logs/${logId}/attachments`)
  return data
}

/**
 * POST /logs/:id/attachments — ajouter une pièce jointe. Réservé au formateur
 * auteur, toujours titulaire de la relation.
 *
 * Corps `multipart/form-data`, un seul fichier, champ `file`. **`Content-Type`
 * neutralisé** (`undefined`) pour que le navigateur pose lui-même l'en-tête
 * avec son `boundary` — même exigence que `uploadProfileAvatar` (voir
 * `src/api/profile.ts`), où poser `multipart/form-data` en dur avait cassé
 * l'envoi en le convertissant en JSON.
 */
export async function uploadLogAttachment(
  logId: string,
  file: File,
): Promise<PedagogicalLogAttachment> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<PedagogicalLogAttachment>(
    `/logs/${logId}/attachments`,
    formData,
    { headers: { 'Content-Type': undefined } },
  )
  return data
}

/**
 * GET /logs/:id/attachments/:attachmentId — télécharger les octets bruts.
 *
 * Route authentifiée par le JWT de l'en-tête `Authorization`, qu'une balise
 * `<a href>` brute n'envoie pas : l'appelant doit récupérer le blob puis
 * déclencher lui-même le téléchargement (object URL + ancre temporaire), même
 * pattern que `downloadArchiveDocument` (`src/api/archiveDocument.ts`).
 */
export async function fetchLogAttachmentBlob(logId: string, attachmentId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/logs/${logId}/attachments/${attachmentId}`, {
    responseType: 'blob',
  })
  return data
}

/**
 * DELETE /logs/:id/attachments/:attachmentId — réservé au formateur auteur,
 * toujours titulaire de la relation.
 */
export async function deleteLogAttachment(logId: string, attachmentId: string): Promise<void> {
  await apiClient.delete(`/logs/${logId}/attachments/${attachmentId}`)
}
