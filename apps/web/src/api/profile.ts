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

// ─── Photo de profil ──────────────────────────────────────────────────────────

/**
 * Réponse de `POST /profiles/:userId/avatar`.
 *
 * `avatarUrl` est l'URL de lecture **versionnée** construite par le serveur,
 * identique à celle du bloc `administrative`. Elle change à chaque remplacement
 * (jeton `?v=`) : c'est elle qu'il faut réutiliser, sinon l'ancienne photo reste
 * affichée depuis le cache du navigateur.
 */
export interface ProfileAvatarUploadResult {
  avatarUrl: string | null
}

/**
 * POST /profiles/:userId/avatar — Envoyer ou remplacer la photo de profil.
 *
 * **Titulaire seul**, sans exception administrative : la photo n'appartient au
 * domaine d'aucun rôle administratif (`docs/routes.md`, 2026-08-10).
 *
 * Corps `multipart/form-data`, un seul fichier, champ `file`. Le `Content-Type`
 * n'est pas posé ici : axios le retire pour un `FormData` afin que le navigateur
 * pose lui-même la limite (`boundary`) du corps multipart.
 */
export async function uploadProfileAvatar(
  userId: string,
  file: File,
): Promise<ProfileAvatarUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post<ProfileAvatarUploadResult>(
    `/profiles/${userId}/avatar`,
    formData,
  )
  return data
}

/**
 * GET /profiles/:userId/avatar — Lire les **octets** de la photo (`image/webp`).
 *
 * La route est authentifiée par le JWT de l'en-tête `Authorization` : elle ne
 * peut donc pas être posée dans un `<img src>`, que le navigateur appellerait
 * sans en-tête. On récupère les octets, puis on en fait un object URL.
 *
 * `versionToken` rejoue le `?v=` de l'`avatarUrl` renvoyé par le serveur, pour
 * qu'un remplacement ne reste pas masqué par le cache.
 *
 * `404` signifie « pas de photo » **ou** « photo masquée pour ce lecteur », sans
 * qu'on puisse — ni qu'on doive — les distinguer.
 */
export async function fetchProfileAvatarBlob(
  userId: string,
  versionToken?: string,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/profiles/${userId}/avatar`, {
    responseType: 'blob',
    params: versionToken ? { v: versionToken } : undefined,
  })
  return data
}

/**
 * DELETE /profiles/:userId/avatar — Supprimer la photo. **Titulaire seul**.
 *
 * Idempotent : supprimer une photo déjà absente répond `204`, jamais `404`. Un
 * double clic sur « Supprimer » ne produit donc pas d'erreur.
 */
export async function deleteProfileAvatar(userId: string): Promise<void> {
  await apiClient.delete(`/profiles/${userId}/avatar`)
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
