/**
 * Pièces jointes du cahier de texte — helpers purs et **point unique** des
 * textes affichés (`docs/routes.md` § « Liens et pièces jointes », 2026-08-26).
 *
 * Même discipline que `profileAvatar.ts` pour la photo de profil : messages
 * d'erreur du serveur traduits par intention (jamais affichés tels quels), et
 * la limite d'envoi ne vient jamais d'une constante recopiée en dur, mais de
 * `GET /pedagogical-logs/settings/attachments`, lue avant d'afficher le
 * bouton « Joindre un fichier ».
 */

import { formatFileSize } from './fileSize'
import { getErrorMessage, getErrorStatus, readErrorPayload } from './apiError'
import { readPositiveNumber } from './profileAvatarConstraints'

export const ATTACHMENT_LABELS = {
  addAction: 'Joindre un fichier',
  uploading: 'Envoi en cours…',
  deleting: 'Suppression…',
  downloading: 'Téléchargement…',
  loading: 'Chargement des pièces jointes…',
  toggleShow: 'Afficher les pièces jointes',
  toggleHide: 'Masquer les pièces jointes',
  /** En-tête de la section quand elle est dépliée par défaut (formateur, `canManage`) — pas de bouton à masquer/afficher dans ce cas. */
  sectionTitle: 'Pièces jointes',
  empty: 'Aucune pièce jointe.',
  deleteAction: 'Supprimer',
  downloadAction: 'Télécharger',
} as const

/** « Taille maximale par fichier : 100 Ko. » — la valeur vient toujours du serveur. */
export function getAttachmentMaxSizeHint(maxFileBytes: number): string {
  return `Taille maximale par fichier : ${formatFileSize(maxFileBytes) ?? ''}.`
}

// ─── Fichier trop lourd ───────────────────────────────────────────────────────

const UPLOAD_FILE_TOO_LARGE_CODE = 'UPLOAD_FILE_TOO_LARGE'
const UPLOAD_TOTAL_SIZE_EXCEEDED_CODE = 'UPLOAD_TOTAL_SIZE_EXCEEDED'

/** L'erreur est-elle un refus pour poids excessif — fichier seul ou budget total ? */
export function isAttachmentUploadTooLargeError(error: unknown): boolean {
  if (getErrorStatus(error) !== 413) return false
  const code = readErrorPayload(error)?.code
  return code === UPLOAD_FILE_TOO_LARGE_CODE || code === UPLOAD_TOTAL_SIZE_EXCEEDED_CODE
}

/** Le budget **total** de l'entrée est-il dépassé (plutôt que le fichier seul) ? */
export function isAttachmentTotalSizeExceededError(error: unknown): boolean {
  return readErrorPayload(error)?.code === UPLOAD_TOTAL_SIZE_EXCEEDED_CODE
}

/**
 * Message de refus pour poids excessif — le même que le refus vienne du
 * contrôle local ou d'un `413` du serveur.
 *
 * @param fileSizeBytes taille du fichier quand elle est connue ; `null` sinon
 *   (`receivedBytes` du serveur est toujours `null` pour ce service — pas
 *   d'interception en streaming, voir `docs/routes.md`).
 */
export function getAttachmentTooLargeMessage(
  fileSizeBytes: number | null,
  maxFileBytes: number,
): string {
  const readableLimit = formatFileSize(maxFileBytes) ?? ''
  const readableFileSize = formatFileSize(fileSizeBytes)

  const firstSentence = readableFileSize
    ? `Ce fichier pèse ${readableFileSize}.`
    : 'Ce fichier est trop lourd pour être envoyé.'

  return `${firstSentence} La taille maximale par fichier est de ${readableLimit}. Choisissez un fichier plus léger.`
}

/** Message de refus quand c'est le budget total de l'entrée qui est dépassé. */
export function getAttachmentTotalSizeExceededMessage(maxTotalBytesPerEntry: number): string {
  const readableLimit = formatFileSize(maxTotalBytesPerEntry) ?? ''
  return `Le total des pièces jointes de cette entrée ne peut pas dépasser ${readableLimit}. Supprimez une pièce jointe existante avant d'en ajouter une nouvelle.`
}

// ─── Traduction des erreurs ───────────────────────────────────────────────────

const UPLOAD_INVALID_FILE_MESSAGE =
  "Ce fichier n'a pas pu être envoyé : son format n'est pas reconnu ou n'est pas autorisé (les fichiers SVG ne le sont pas)."

const UPLOAD_FORBIDDEN_MESSAGE =
  "Vous n'êtes pas autorisé à ajouter une pièce jointe à cette entrée, ou les pièces jointes sont désactivées."

const UPLOAD_NOT_FOUND_MESSAGE = 'Cette entrée du cahier de texte est introuvable.'

const UPLOAD_SERVER_MESSAGE = "La pièce jointe n'a pas pu être enregistrée. Réessayez dans quelques instants."

const UPLOAD_FALLBACK_MESSAGE = "La pièce jointe n'a pas pu être envoyée. Réessayez."

/** Contexte connu du front au moment de l'échec, pour un message plus précis. */
export interface AttachmentUploadErrorContext {
  /** Plafond par fichier lu sur les réglages, si l'appel a abouti. */
  maxFileBytes?: number
  /** Plafond total par entrée, si connu. */
  maxTotalBytesPerEntry?: number
  /** `File.size` du fichier tenté — le front le connaît toujours. */
  attemptedFileSizeBytes?: number
}

/** Traduit un échec d'envoi de pièce jointe en message affichable. */
export function getAttachmentUploadErrorMessage(
  error: unknown,
  context: AttachmentUploadErrorContext = {},
): string {
  const status = getErrorStatus(error)

  if (isAttachmentUploadTooLargeError(error)) {
    const payload = readErrorPayload(error)

    if (isAttachmentTotalSizeExceededError(error)) {
      const maxTotalBytesPerEntry =
        readPositiveNumber(context.maxTotalBytesPerEntry) ?? 5_000_000
      return getAttachmentTotalSizeExceededMessage(maxTotalBytesPerEntry)
    }

    const maxFileBytes =
      readPositiveNumber(payload?.maxUploadBytes) ??
      readPositiveNumber(context.maxFileBytes) ??
      100_000

    const attemptedFileSizeBytes = readPositiveNumber(context.attemptedFileSizeBytes)
    const knownFileSizeBytes =
      readPositiveNumber(payload?.receivedBytes) ??
      (attemptedFileSizeBytes !== null && attemptedFileSizeBytes > maxFileBytes
        ? attemptedFileSizeBytes
        : null)

    return getAttachmentTooLargeMessage(knownFileSizeBytes, maxFileBytes)
  }

  if (status === 400) return UPLOAD_INVALID_FILE_MESSAGE
  if (status === 403) return UPLOAD_FORBIDDEN_MESSAGE
  if (status === 404) return UPLOAD_NOT_FOUND_MESSAGE
  if (status !== undefined && status >= 500) return UPLOAD_SERVER_MESSAGE

  return getErrorMessage(error, UPLOAD_FALLBACK_MESSAGE)
}

const DELETE_FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à supprimer cette pièce jointe."
const DELETE_FALLBACK_MESSAGE = "La pièce jointe n'a pas pu être supprimée. Réessayez."

/** Traduit un échec de suppression de pièce jointe. */
export function getAttachmentDeleteErrorMessage(error: unknown): string {
  if (getErrorStatus(error) === 403) return DELETE_FORBIDDEN_MESSAGE
  return getErrorMessage(error, DELETE_FALLBACK_MESSAGE)
}

const LOAD_FORBIDDEN_MESSAGE = "Vous n'avez pas accès aux pièces jointes de cette entrée."
const LOAD_FALLBACK_MESSAGE = 'Les pièces jointes n\'ont pas pu être affichées.'

/** Traduit un échec de lecture (liste) des pièces jointes. */
export function getAttachmentLoadErrorMessage(error: unknown): string {
  if (getErrorStatus(error) === 403) return LOAD_FORBIDDEN_MESSAGE
  return getErrorMessage(error, LOAD_FALLBACK_MESSAGE)
}

const DOWNLOAD_FALLBACK_MESSAGE = "Ce fichier n'a pas pu être téléchargé. Réessayez."

/** Traduit un échec de téléchargement d'une pièce jointe. */
export function getAttachmentDownloadErrorMessage(error: unknown): string {
  if (getErrorStatus(error) === 403) return LOAD_FORBIDDEN_MESSAGE
  return getErrorMessage(error, DOWNLOAD_FALLBACK_MESSAGE)
}
