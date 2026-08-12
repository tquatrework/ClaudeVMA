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
import type { PaginatedResponse } from '../types/pagination'
import type {
  AdministrativeProfileFields,
  DeclarativePedagogicalFields,
  FieldVisibilitySettings,
  FieldVisibilityUpdate,
  InternalNote,
  PrescriptionFields,
  Profile,
  ProfileAvatarConstraints,
  ProfileStatisticsResponse,
  SavedProfileBlock,
  ValidatedTeacher,
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
 *
 * Renvoie le bloc **à jour**, à plat : `{userId, ...champsAdmin}`, traçabilité
 * (`updatedAt`) et `avatarUrl` compris. C'est cette réponse qui doit être
 * affichée après un enregistrement — le serveur normalise et complète, réafficher
 * le corps envoyé mentirait à l'écran. D'où un type plus large que celui du
 * corps : `SavedProfileBlock`.
 */
export async function updateAdministrativeProfile(
  userId: string,
  payload: AdministrativeProfileFields,
): Promise<SavedProfileBlock> {
  const { data } = await apiClient.put<SavedProfileBlock>(
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
 *
 * Renvoie le bloc **à jour**, à plat : `{userId, ...champsPedago}`. À fusionner
 * dans le bloc `pedagogical` détenu par l'écran, jamais à substituer à
 * l'enveloppe de `GET /profiles/:userId`.
 */
export async function updatePedagogicalProfile(
  userId: string,
  payload: DeclarativePedagogicalFields,
): Promise<SavedProfileBlock> {
  const { data } = await apiClient.put<SavedProfileBlock>(
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
 *
 * La réponse est le profil pédagogique **complet** — sections confondues, plus
 * `filledBy`/`filledAt`. C'est la seule façon d'afficher l'auteur et la date de
 * la prescription sans relire le profil : ils n'existent nulle part dans le corps
 * envoyé.
 */
export async function updatePrescription(
  userId: string,
  payload: PrescriptionFields,
): Promise<SavedProfileBlock> {
  const { data } = await apiClient.put<SavedProfileBlock>(
    `/profiles/${userId}/prescription`,
    payload,
  )
  return data
}

// ─── Photo de profil ──────────────────────────────────────────────────────────

/**
 * GET /profiles/avatar/constraints — Contraintes d'envoi en vigueur.
 *
 * **À lire AVANT d'ouvrir le sélecteur de fichier** : c'est ce qui permet
 * d'annoncer la limite à l'utilisateur et de refuser un fichier trop lourd sans
 * l'envoyer. Pas de `:userId` — les contraintes ne dépendent ni du profil visé
 * ni du lecteur ; tout compte authentifié peut les lire.
 */
export async function fetchProfileAvatarConstraints(): Promise<ProfileAvatarConstraints> {
  const { data } = await apiClient.get<ProfileAvatarConstraints>('/profiles/avatar/constraints')
  return data
}

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
 * Corps `multipart/form-data`, un seul fichier, champ `file`.
 *
 * Le `Content-Type` est explicitement **neutralisé** (`undefined`) pour cet
 * appel. Contrairement à ce que disait le commentaire précédent, axios ne
 * retire pas de lui-même l'en-tête pour un `FormData` : si un `Content-Type`
 * JSON est déjà posé — et `apiClient` en pose un par défaut —, son
 * `transformRequest` **convertit le `FormData` en JSON** et le fichier est perdu
 * à l'émission. C'est ce qui faisait échouer tout envoi depuis le navigateur en
 * `400 « Aucun fichier reçu. »` alors que le même appel en `curl` répondait
 * `200` (constat du 2026-08-10).
 *
 * Sans en-tête, le navigateur pose lui-même `multipart/form-data; boundary=…`.
 * Ne jamais poser `multipart/form-data` en dur ici : privé du `boundary`, le
 * corps redeviendrait illisible côté serveur.
 *
 * `apiClient` neutralise déjà l'en-tête pour tout corps `FormData` ; la
 * consigne est répétée ici parce qu'elle fait partie du contrat de la route.
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
    { headers: { 'Content-Type': undefined } },
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

// ─── Annuaire des formateurs validés ──────────────────────────────────────────

/**
 * Plafond de pagination **déclaré par le serveur** : `limit > 100` est refusé en
 * `400`, jamais rogné en silence. On demande donc exactement le maximum, pour
 * qu'un annuaire courant tienne en un seul aller-retour.
 */
export const VALIDATED_TEACHERS_MAX_LIMIT = 100

/**
 * GET /profiles/teachers/validated — Annuaire des formateurs validés.
 *
 * Réservé aux administrateurs (RP, AF, TI) ; tout autre rôle reçoit `403`,
 * **l'animateur pédagogique compris**. Source de l'étape 3 du flow « demande de
 * professeur » : le RP y désigne les destinataires d'une proposition sans jamais
 * saisir d'identifiant technique.
 *
 * ⚠️ La réponse est une **enveloppe** `{data, page, limit, total, totalPages}`,
 * pas un tableau nu : lire la racine ne renverrait jamais aucun formateur.
 * Une page au-delà de la dernière répond `200 {data: []}`, jamais `404`.
 */
export async function fetchValidatedTeachers(
  page = 1,
  limit = VALIDATED_TEACHERS_MAX_LIMIT,
): Promise<PaginatedResponse<ValidatedTeacher>> {
  const { data } = await apiClient.get<PaginatedResponse<ValidatedTeacher>>(
    '/profiles/teachers/validated',
    { params: { page, limit } },
  )
  return data
}
