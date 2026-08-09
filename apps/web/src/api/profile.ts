/**
 * Module API — profils (profile-service)
 *
 * Lecture/écriture des profils administratif et pédagogique, prescription
 * réservée au RP, notes internes confidentielles, statistiques pédagogiques et
 * visibilité champ par champ.
 * Toutes les requêtes passent par apiClient (base /api/v1).
 *
 * Écart signalé (non documenté dans docs/routes.md, comportement runtime préservé
 * tel quel) : GET /profiles/:userId/statistics
 */

import apiClient from './client'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  FieldVisibilitySettings,
  FieldVisibilityUpdate,
  InternalNote,
  PrescriptionFields,
  Profile,
  ProfileStatisticsResponse,
} from '../types/profile'

// ─── Profil ───────────────────────────────────────────────────────────────────

/**
 * GET /profiles/:userId — Lire un profil (administratif + pédagogique)
 *
 * **Réponse filtrée champ par champ** depuis le 2026-08-09 : les champs que le
 * titulaire ne partage pas avec le lecteur sont **absents** des blocs et nommés
 * dans `visibility.hiddenFields`. Aucune clé du catalogue n'est donc garantie
 * présente — voir `ProfileVisibility` dans `src/types/profile.ts`.
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
 * PUT /profiles/:userId/pedagogical — Modifier la **section déclarative** du
 * profil pédagogique, celle que le titulaire écrit sur lui-même.
 *
 * N'accepte aucun champ de prescription, ni `filledBy`/`filledAt`, ni
 * `isAnimateurPedagogique` : le serveur répond `400` au lieu de les ignorer.
 */
export async function updatePedagogicalProfile(
  userId: string,
  payload: DeclarativePedagogicalFields,
): Promise<DeclarativePedagogicalFields> {
  const { data } = await apiClient.put<DeclarativePedagogicalFields>(
    `/profiles/${userId}/pedagogical`,
    payload,
  )
  return data
}

/**
 * PUT /profiles/:userId/prescription — Modifier la **section prescription** du
 * profil pédagogique. Réservée au responsable pédagogique, y compris quand la
 * cible est l'appelant lui-même (`403` pour tout autre rôle).
 *
 * `filledBy` et `filledAt` sont posés par le serveur : les envoyer renvoie `400`.
 */
export async function updatePrescription(
  userId: string,
  payload: PrescriptionFields,
): Promise<PrescriptionFields> {
  const { data } = await apiClient.put<PrescriptionFields>(
    `/profiles/${userId}/prescription`,
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
 * La réponse est une **enveloppe** `{userId, profileType, statistics, visibility}`
 * (`docs/routes.md` § profile-service, documentée le 2026-08-09) : les données
 * sont dans `statistics`, pas à la racine. Le front lisait jusqu'ici la racine
 * comme si elle portait les indicateurs, ce qui ne pouvait rien afficher.
 *
 * La route applique les mêmes réglages de visibilité que le bloc `pedagogical` :
 * un champ masqué est absent de `statistics` et nommé dans `visibility.hiddenFields`.
 */
export async function fetchProfileStatistics(
  userId: string,
): Promise<ProfileStatisticsResponse> {
  const { data } = await apiClient.get<ProfileStatisticsResponse>(
    `/profiles/${userId}/statistics`,
  )
  return data
}

// ─── Visibilité champ par champ ───────────────────────────────────────────────

/**
 * GET /profiles/:userId/field-visibility — Lire la visibilité effective de tous
 * les champs du catalogue, valeurs par défaut comprises.
 *
 * Remplace `GET /profiles/:userId/visibility-preferences`, supprimée côté serveur
 * (`404` désormais) avec ses deux booléens nommés en dur. Un seul appel suffit à
 * construire l'écran : le front ne duplique ni le catalogue ni les défauts.
 */
export async function fetchFieldVisibility(userId: string): Promise<FieldVisibilitySettings> {
  const { data } = await apiClient.get<FieldVisibilitySettings>(
    `/profiles/${userId}/field-visibility`,
  )
  return data
}

/**
 * PUT /profiles/:userId/field-visibility — Régler la visibilité champ par champ.
 *
 * **Upsert partiel** : seuls les champs listés sont modifiés, les autres gardent
 * leur réglage. On n'envoie donc que ce que l'utilisateur a changé.
 */
export async function updateFieldVisibility(
  userId: string,
  fields: FieldVisibilityUpdate[],
): Promise<FieldVisibilitySettings> {
  const { data } = await apiClient.put<FieldVisibilitySettings>(
    `/profiles/${userId}/field-visibility`,
    { fields },
  )
  return data
}
