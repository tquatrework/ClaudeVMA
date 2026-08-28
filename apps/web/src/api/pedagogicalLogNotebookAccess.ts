/**
 * Module API — réglages d'accès admin/parent au carnet personnel
 * (pedagogical-log-service).
 *
 * Arbitrage du 2026-08-28 (docs/architecture.md « Acces administratif et
 * parental au carnet personnel — parametrable par le TI, defaut ferme »).
 * Contrat confirmé par le sous-agent pedagogical-log-service, PR #147
 * (https://github.com/tquatrework/ClaudeVMA/pull/147, non encore mergée au
 * moment de l'écriture de ce module — voir le rapport de session pour le
 * détail de la vérification).
 *
 * Deux axes indépendants :
 * - `adminAccess` : curseur hiérarchique `none` < `rp` < `all_admins`.
 * - `parentAccessToOwnChild` : case à cocher indépendante.
 *
 * Lecture ouverte à tout compte authentifié (le front doit savoir si un
 * point d'entrée de consultation a un sens avant de l'afficher, même
 * discipline que `GET /pedagogical-logs/settings/attachments`) ; écriture
 * réservée au technicien_informatique.
 */

import apiClient from './client'

export type NotebookAdminAccess = 'none' | 'rp' | 'all_admins'

export interface NotebookAccessSettings {
  id: string
  adminAccess: NotebookAdminAccess
  parentAccessToOwnChild: boolean
  updatedAt: string
}

/** Mise à jour partielle — n'envoyer que les champs réellement modifiés. */
export interface UpdateNotebookAccessSettingsPayload {
  adminAccess?: NotebookAdminAccess
  parentAccessToOwnChild?: boolean
}

/** GET /pedagogical-logs/settings/notebook-access — réglages courants. */
export async function fetchNotebookAccessSettings(): Promise<NotebookAccessSettings> {
  const { data } = await apiClient.get<NotebookAccessSettings>(
    '/pedagogical-logs/settings/notebook-access',
  )
  return data
}

/**
 * PATCH /pedagogical-logs/settings/notebook-access — technicien_informatique
 * seul. Mise à jour **partielle** : seuls les champs présents dans `payload`
 * sont modifiés. Renvoie la réponse du serveur (jamais le corps envoyé) —
 * règle du 2026-08-10, point 3bis.
 */
export async function updateNotebookAccessSettings(
  payload: UpdateNotebookAccessSettingsPayload,
): Promise<NotebookAccessSettings> {
  const { data } = await apiClient.patch<NotebookAccessSettings>(
    '/pedagogical-logs/settings/notebook-access',
    payload,
  )
  return data
}
