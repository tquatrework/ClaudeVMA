/**
 * Photo de profil — helpers purs et **point unique** des textes affichés.
 *
 * Trois routes côté serveur (`docs/routes.md` § « Photo de profil », 2026-08-10) :
 * `POST`, `GET` et `DELETE /profiles/:userId/avatar`. Elles sont authentifiées
 * par le JWT porté dans l'en-tête `Authorization`, que le navigateur n'envoie
 * jamais sur une balise `<img>` : les octets sont donc récupérés par requête puis
 * transformés en object URL (voir `useProfileAvatar`).
 *
 * Comme partout dans le projet, les noms techniques restent en anglais et tout
 * ce que l'utilisateur lit est en français. `profile-service` renvoie des
 * messages d'erreur techniques en anglais (« Unsupported image format »…) : on ne
 * les affiche jamais tels quels, on traduit par intention.
 */

import { getErrorMessage, getErrorStatus } from './apiError'

// ─── Formats acceptés ─────────────────────────────────────────────────────────

/**
 * Types acceptés par `POST /profiles/:userId/avatar`. Le serveur ne fait pas
 * confiance à cette liste — il détecte le format sur les **octets réels** — mais
 * l'attribut `accept` évite à l'utilisateur de choisir un fichier voué au refus.
 *
 * SVG (document XML exécutable) et HEIC/HEIF sont refusés côté serveur : ils
 * n'ont donc pas leur place ici.
 */
export const ACCEPTED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

/** Valeur de l'attribut `accept` du champ de fichier. */
export const AVATAR_FILE_INPUT_ACCEPT = ACCEPTED_AVATAR_MIME_TYPES.join(',')

// ─── Textes affichés ──────────────────────────────────────────────────────────

/**
 * Libellés de l'emplacement photo. Le titre du bloc n'est pas repris ici : il
 * vient de `getProfileFieldLabel('avatarUrl')`, point unique des libellés de
 * champs de profil.
 */
export const AVATAR_LABELS = {
  addAction: 'Ajouter une photo',
  replaceAction: 'Changer la photo',
  deleteAction: 'Supprimer la photo',
  uploading: 'Envoi en cours…',
  deleting: 'Suppression…',
  loading: 'Chargement de la photo…',
  /**
   * Affiché au **titulaire** seulement : pour lui, l'absence de photo n'a qu'une
   * cause possible. Un lecteur tiers, lui, ne doit rien lire de tel — un `404`
   * signifie « pas de photo » **ou** « photo non partagée », et l'interface n'a
   * pas à trancher ce que le serveur masque volontairement.
   */
  emptyForOwner: "Vous n'avez pas encore ajouté de photo.",
  formatsHint:
    'JPEG, PNG, WebP, GIF ou AVIF. La photo est redimensionnée et ses métadonnées (dont la géolocalisation) sont supprimées.',
  /** Texte alternatif de l'image, sans nom quand celui-ci n'est pas lisible. */
  defaultImageAlt: 'Photo de profil',
} as const

/** Texte alternatif de l'image : nom de la personne quand il est connu. */
export function getAvatarImageAlt(displayName?: string | null): string {
  const trimmedName = displayName?.trim()
  return trimmedName
    ? `${AVATAR_LABELS.defaultImageAlt} de ${trimmedName}`
    : AVATAR_LABELS.defaultImageAlt
}

// ─── Jeton de version ─────────────────────────────────────────────────────────

/**
 * Extrait le jeton `?v=` de l'`avatarUrl` renvoyé par le serveur.
 *
 * Ce jeton porte l'horodatage du dernier envoi et **change à chaque
 * remplacement** : le rejouer sur la requête de lecture est ce qui empêche
 * l'ancienne photo de rester affichée depuis le cache du navigateur. On ne
 * réutilise pas l'`avatarUrl` complet comme URL d'appel — il porte le préfixe
 * `/api/v1`, déjà présent dans la base d'`apiClient`.
 */
export function extractAvatarVersionToken(
  avatarUrl: string | null | undefined,
): string | undefined {
  if (!avatarUrl) return undefined

  const queryStringStart = avatarUrl.indexOf('?')
  if (queryStringStart === -1) return undefined

  const versionToken = new URLSearchParams(avatarUrl.slice(queryStringStart + 1)).get('v')
  return versionToken || undefined
}

// ─── Traduction des erreurs ───────────────────────────────────────────────────

const UPLOAD_INVALID_FILE_MESSAGE =
  "Ce fichier n'a pas pu être lu comme une image. Formats acceptés : JPEG, PNG, WebP, GIF ou AVIF — les fichiers SVG et HEIC ne le sont pas."

/**
 * `413` — cas courant en production : nginx plafonne aujourd'hui les envois à
 * environ 1 Mo en amont du service, alors qu'une photo de téléphone pèse
 * couramment 2 à 5 Mo (`docs/routes.md`, avertissement du 2026-08-10). Le message
 * parle donc de **poids de fichier** et de ce que l'utilisateur peut faire, pas
 * d'un code HTTP qui ne lui apprendrait rien.
 */
const UPLOAD_TOO_LARGE_MESSAGE =
  'Cette photo est trop lourde pour être envoyée. Choisissez une image de moins de 1 Mo, ou réduisez sa taille avant de réessayer.'

const UPLOAD_FORBIDDEN_MESSAGE =
  'Seul le titulaire du profil peut changer sa photo.'

const UPLOAD_SERVER_MESSAGE =
  "La photo n'a pas pu être enregistrée. Réessayez dans quelques instants."

const UPLOAD_FALLBACK_MESSAGE = "La photo n'a pas pu être envoyée. Réessayez."

/** Traduit un échec d'envoi de photo en message affichable. */
export function getAvatarUploadErrorMessage(error: unknown): string {
  const status = getErrorStatus(error)

  if (status === 400) return UPLOAD_INVALID_FILE_MESSAGE
  if (status === 403) return UPLOAD_FORBIDDEN_MESSAGE
  if (status === 413) return UPLOAD_TOO_LARGE_MESSAGE
  if (status !== undefined && status >= 500) return UPLOAD_SERVER_MESSAGE

  return getErrorMessage(error, UPLOAD_FALLBACK_MESSAGE)
}

const DELETE_FORBIDDEN_MESSAGE = 'Seul le titulaire du profil peut supprimer sa photo.'
const DELETE_FALLBACK_MESSAGE = "La photo n'a pas pu être supprimée. Réessayez."

/**
 * Traduit un échec de suppression. `DELETE` est **idempotent** côté serveur :
 * supprimer une photo déjà absente répond `204`, un double clic ne produit donc
 * jamais d'erreur à traduire ici.
 */
export function getAvatarDeleteErrorMessage(error: unknown): string {
  if (getErrorStatus(error) === 403) return DELETE_FORBIDDEN_MESSAGE
  return getErrorMessage(error, DELETE_FALLBACK_MESSAGE)
}

const LOAD_FORBIDDEN_MESSAGE = "Vous n'avez pas accès à ce profil."
const LOAD_FALLBACK_MESSAGE = "La photo n'a pas pu être affichée."

/**
 * Traduit un échec d'affichage.
 *
 * Le `404` n'arrive **jamais** ici : il signifie « pas de photo » **ou** « photo
 * masquée pour ce lecteur », deux états que le serveur rend volontairement
 * indiscernables. Il se traite comme une absence — pastille d'initiales — et non
 * comme une erreur, sans quoi l'interface affirmerait l'une des deux causes.
 */
export function getAvatarLoadErrorMessage(error: unknown): string {
  if (getErrorStatus(error) === 403) return LOAD_FORBIDDEN_MESSAGE
  return getErrorMessage(error, LOAD_FALLBACK_MESSAGE)
}
