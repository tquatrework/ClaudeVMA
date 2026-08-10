/**
 * Photo de profil — helpers purs et **point unique** des textes affichés.
 *
 * Quatre routes côté serveur (`docs/routes.md` § « Photo de profil »,
 * 2026-08-10) : `GET /profiles/avatar/constraints`, puis `POST`, `GET` et
 * `DELETE /profiles/:userId/avatar`. Elles sont authentifiées par le JWT porté
 * dans l'en-tête `Authorization`, que le navigateur n'envoie jamais sur une
 * balise `<img>` : les octets sont donc récupérés par requête puis transformés
 * en object URL (voir `useProfileAvatar`).
 *
 * Comme partout dans le projet, les noms techniques restent en anglais et tout
 * ce que l'utilisateur lit est en français. `profile-service` renvoie des
 * messages d'erreur techniques en anglais (« Unsupported image format »…) : on ne
 * les affiche jamais tels quels, on traduit par intention.
 *
 * **La limite d'envoi n'est écrite en dur nulle part ici.** Elle vient de
 * `GET /profiles/avatar/constraints` et traverse ce module en paramètre — le
 * contrat serveur lui-même est porté par `profileAvatarConstraints.ts`.
 */

import { formatFileSize } from './fileSize'
import { getErrorMessage, getErrorStatus } from './apiError'
import { FALLBACK_AVATAR_CONSTRAINTS, readPositiveNumber } from './profileAvatarConstraints'

// ─── Formats affichés ─────────────────────────────────────────────────────────

/**
 * Nom lisible d'un type MIME d'image. Un type inconnu — le serveur peut en
 * ajouter — se replie sur son sous-type en majuscules (`image/heif` → `HEIF`)
 * plutôt que de disparaître de la liste annoncée.
 */
const IMAGE_FORMAT_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/avif': 'AVIF',
}

function getImageFormatLabel(contentType: string): string {
  return IMAGE_FORMAT_LABELS[contentType] ?? contentType.replace(/^image\//, '').toUpperCase()
}

/** Énumération française des formats : « JPEG, PNG, WebP, GIF ou AVIF ». */
export function formatAcceptedImageFormats(acceptedContentTypes: readonly string[]): string {
  const labels = acceptedContentTypes.map(getImageFormatLabel)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} ou ${labels[labels.length - 1]}`
}

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
  /**
   * Conseil affiché **avant** le choix du fichier. La limite est basse au regard
   * d'une photo de téléphone (3 à 8 Mo) : la majorité des tentatives échoueraient
   * sans cet avertissement. Une phrase, et elle dit quoi faire.
   */
  reduceAdvice:
    "Une photo prise au téléphone dépasse presque toujours cette limite : réduisez-la ou recadrez-la avant de l'envoyer.",
  /** Ce que le serveur fait de la photo — rassure sur la géolocalisation. */
  processingHint:
    'La photo est redimensionnée et ses métadonnées (dont la géolocalisation) sont supprimées.',
  /** Texte alternatif de l'image, sans nom quand celui-ci n'est pas lisible. */
  defaultImageAlt: 'Photo de profil',
} as const

/** « Taille maximale : 1 Mo. » — la valeur vient toujours du serveur. */
export function getAvatarMaxSizeHint(maxUploadBytes: number): string {
  return `Taille maximale : ${formatFileSize(maxUploadBytes) ?? ''}.`
}

/** « Formats acceptés : JPEG, PNG, WebP, GIF ou AVIF. » */
export function getAvatarFormatsHint(acceptedContentTypes: readonly string[]): string {
  return `Formats acceptés : ${formatAcceptedImageFormats(acceptedContentTypes)}.`
}

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

// ─── Fichier trop lourd ───────────────────────────────────────────────────────

/**
 * Message de refus pour poids excessif — **le même** que le refus vienne du
 * contrôle local ou d'un `413` du serveur. Deux formulations pour un même motif
 * ne feraient qu'ajouter à la confusion.
 *
 * @param fileSizeBytes taille du fichier quand elle est connue ; `null` quand
 *   elle ne l'est pas (`receivedBytes: null` du serveur, flux coupé). On ne
 *   remplace jamais une taille inconnue par « 0 octet ».
 */
export function getAvatarTooLargeMessage(
  fileSizeBytes: number | null,
  maxUploadBytes: number,
): string {
  const readableLimit = formatFileSize(maxUploadBytes) ?? ''
  const readableFileSize = formatFileSize(fileSizeBytes)

  const firstSentence = readableFileSize
    ? `Cette photo pèse ${readableFileSize}.`
    : 'Cette photo est trop lourde pour être envoyée.'

  return `${firstSentence} La taille maximale est de ${readableLimit}. Réduisez ou recadrez la photo avant de réessayer.`
}

/**
 * Corps d'erreur exploitable, quelle que soit la forme reçue.
 *
 * Le `413` de l'application est du JSON structuré, mais si les deux plafonds
 * venaient à diverger celui de nginx s'appliquerait le premier et renverrait une
 * **page HTML**. Un `JSON.parse` qui explose ne doit pas se transformer en
 * erreur incompréhensible : on retombe simplement sur « pas de corps lisible »,
 * et le message français reste le même.
 */
function readErrorPayload(error: unknown): Record<string, unknown> | null {
  const payload = (error as { response?: { data?: unknown } })?.response?.data

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }

  if (typeof payload === 'string') {
    try {
      const parsed: unknown = JSON.parse(payload)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Page HTML de nginx, ou corps tronqué : rien d'exploitable, et ce n'est
      // pas une anomalie à signaler à l'utilisateur.
      return null
    }
  }

  return null
}

/** Code stable du refus pour poids excessif — seul point d'accroche du front. */
const UPLOAD_FILE_TOO_LARGE_CODE = 'UPLOAD_FILE_TOO_LARGE'

/**
 * L'erreur est-elle un refus pour poids excessif ?
 *
 * On s'accroche au statut `413` **et** au champ `code`, jamais à `message` :
 * celui-ci est en anglais technique et ne fait pas partie du contrat.
 */
export function isAvatarUploadTooLargeError(error: unknown): boolean {
  if (getErrorStatus(error) === 413) return true
  return readErrorPayload(error)?.code === UPLOAD_FILE_TOO_LARGE_CODE
}

// ─── Traduction des erreurs ───────────────────────────────────────────────────

const UPLOAD_INVALID_FILE_MESSAGE =
  "Ce fichier n'a pas pu être lu comme une image. Formats acceptés : JPEG, PNG, WebP, GIF ou AVIF — les fichiers SVG et HEIC ne le sont pas."

const UPLOAD_FORBIDDEN_MESSAGE = 'Seul le titulaire du profil peut changer sa photo.'

const UPLOAD_SERVER_MESSAGE =
  "La photo n'a pas pu être enregistrée. Réessayez dans quelques instants."

const UPLOAD_FALLBACK_MESSAGE = "La photo n'a pas pu être envoyée. Réessayez."

/** Contexte connu du front au moment de l'échec, pour un message plus précis. */
export interface AvatarUploadErrorContext {
  /** Plafond lu sur `GET /profiles/avatar/constraints`, si l'appel a abouti. */
  maxUploadBytes?: number
  /** `File.size` du fichier tenté — le front le connaît toujours. */
  attemptedFileSizeBytes?: number
}

/**
 * Traduit un échec d'envoi de photo en message affichable.
 *
 * Cas `413` — le plus courant en production tant que le reverse-proxy plafonne
 * à 1 Mio. Ordre d'autorité pour la limite citée : le corps de la réponse (le
 * serveur sait ce qu'il vient d'appliquer), puis les contraintes lues à
 * l'affichage, puis le repli. La taille du fichier, elle, vient de
 * `receivedBytes` si le serveur a pu la mesurer, sinon de `File.size` — mais
 * **seulement si elle dépasse effectivement le plafond** : citer « 3 octets »
 * face à une limite de 1 Mo n'expliquerait rien et ferait douter du message.
 */
export function getAvatarUploadErrorMessage(
  error: unknown,
  context: AvatarUploadErrorContext = {},
): string {
  const status = getErrorStatus(error)

  if (isAvatarUploadTooLargeError(error)) {
    const payload = readErrorPayload(error)
    const maxUploadBytes =
      readPositiveNumber(payload?.maxUploadBytes) ??
      readPositiveNumber(context.maxUploadBytes) ??
      FALLBACK_AVATAR_CONSTRAINTS.maxUploadBytes

    const attemptedFileSizeBytes = readPositiveNumber(context.attemptedFileSizeBytes)
    const knownFileSizeBytes =
      readPositiveNumber(payload?.receivedBytes) ??
      (attemptedFileSizeBytes !== null && attemptedFileSizeBytes > maxUploadBytes
        ? attemptedFileSizeBytes
        : null)

    return getAvatarTooLargeMessage(knownFileSizeBytes, maxUploadBytes)
  }

  if (status === 400) return UPLOAD_INVALID_FILE_MESSAGE
  if (status === 403) return UPLOAD_FORBIDDEN_MESSAGE
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
