/**
 * Module API — profils (profile-service)
 *
 * Lecture/écriture des profils administratif et pédagogique, notes internes
 * confidentielles, statistiques pédagogiques et préférences de confidentialité.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écarts signalés (non documentés dans docs/routes.md, comportement runtime préservé
 * tel quel — voir rapport de migration du lot) :
 * - GET /profiles/:userId/statistics
 * - GET /profiles/:userId/visibility-preferences
 * - PATCH /profiles/:userId/visibility-preferences
 */

import apiClient from './client'
import type {
  AdministrativeProfileFields,
  InternalNote,
  PedagogicalProfileFields,
  PedagogicalStatistics,
  Profile,
  VisibilityPreferences,
} from '../types/profile'

// ─── Profil ───────────────────────────────────────────────────────────────────

/**
 * GET /profiles/:userId — Lire un profil (administratif + pédagogique)
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data } = await apiClient.get<Profile>(`/profiles/${userId}`)
  return data
}

/**
 * PUT /profiles/:userId/administrative — Modifier le profil administratif
 */
export async function updateAdministrativeProfile(
  userId: string,
  payload: AdministrativeProfileFields,
): Promise<AdministrativeProfileFields> {
  const { data } = await apiClient.put<AdministrativeProfileFields>(
    `/profiles/${userId}/administrative`,
    payload,
  )
  return data
}

/**
 * PUT /profiles/:userId/pedagogical — Modifier le profil pédagogique
 */
export async function updatePedagogicalProfile(
  userId: string,
  payload: PedagogicalProfileFields,
): Promise<PedagogicalProfileFields> {
  const { data } = await apiClient.put<PedagogicalProfileFields>(
    `/profiles/${userId}/pedagogical`,
    payload,
  )
  return data
}

// ─── Notes internes confidentielles ──────────────────────────────────────────

/**
 * GET /profiles/:userId/internal-notes — Lister les notes internes
 */
export async function fetchInternalNotes(userId: string): Promise<InternalNote[]> {
  const { data } = await apiClient.get<InternalNote[]>(`/profiles/${userId}/internal-notes`)
  return data
}

/**
 * POST /profiles/:userId/internal-notes — Créer une note interne
 */
export async function createInternalNote(userId: string, content: string): Promise<InternalNote> {
  const { data } = await apiClient.post<InternalNote>(`/profiles/${userId}/internal-notes`, {
    content,
  })
  return data
}

// ─── Statistiques pédagogiques ────────────────────────────────────────────────

/**
 * GET /profiles/:userId/statistics — Lire les statistiques pédagogiques
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md. Reproduite ici à
 * l'identique du comportement préexistant — non corrigée dans ce lot structurel.
 */
export async function fetchProfileStatistics(userId: string): Promise<PedagogicalStatistics> {
  const { data } = await apiClient.get<PedagogicalStatistics>(`/profiles/${userId}/statistics`)
  return data
}

// ─── Préférences de confidentialité ───────────────────────────────────────────

/**
 * GET /profiles/:userId/visibility-preferences — Lire les préférences de confidentialité
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md. Reproduite ici à
 * l'identique du comportement préexistant — non corrigée dans ce lot structurel.
 */
export async function fetchVisibilityPreferences(userId: string): Promise<VisibilityPreferences> {
  const { data } = await apiClient.get<VisibilityPreferences>(
    `/profiles/${userId}/visibility-preferences`,
  )
  return data
}

/**
 * PATCH /profiles/:userId/visibility-preferences — Modifier les préférences de confidentialité
 *
 * Écart : cette route n'apparaît pas dans docs/routes.md. Reproduite ici à
 * l'identique du comportement préexistant — non corrigée dans ce lot structurel.
 */
export async function updateVisibilityPreferences(
  userId: string,
  payload: VisibilityPreferences,
): Promise<VisibilityPreferences> {
  const { data } = await apiClient.patch<VisibilityPreferences>(
    `/profiles/${userId}/visibility-preferences`,
    payload,
  )
  return data
}
