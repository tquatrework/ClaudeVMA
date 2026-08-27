/**
 * memo.ts — constantes, libellés et helpers purs du Mémo élève
 * (`docs/routes.md` § « Mémo élève — assaini le 2026-08-27 »).
 *
 * Même discipline que `logAttachment.ts` pour les pièces jointes du cahier de
 * texte : la limite d'envoi ne vient jamais d'une constante recopiée en dur
 * sans justification — mais pour les images du Mémo, **aucune route de
 * contraintes n'existe côté serveur** (contrairement à
 * `GET /profiles/avatar/constraints`), le plafond est un réglage de code
 * (`MEMO_IMAGE_MAX_BYTES`), non paramétrable par le TI pour l'instant
 * (`docs/routes.md`, section « Plafonds »). Il est donc légitimement recopié
 * ici, avec ce commentaire pour retrouver la source si le serveur l'expose un
 * jour via une route dédiée.
 */

import { formatFileSize } from './fileSize'
import { getErrorMessage, getErrorStatus, readErrorPayload } from './apiError'

// ─── Plafonds serveur, recopiés faute de route de contraintes ────────────────

/** `MEMO_ITEM_CONTENT_MAX_LENGTH` côté serveur — texte ou formule. */
export const MEMO_ITEM_CONTENT_MAX_LENGTH = 5000
/** `title` de chapitre. */
export const MEMO_CHAPTER_TITLE_MAX_LENGTH = 200
/**
 * `title` d'item (texte/formule/image, optionnel pour les trois) —
 * `MEMO_ITEM_TITLE_MAX_LENGTH` côté serveur, ajouté le 2026-08-27 par
 * `AddTitleToMemoItems1789600000000` (`docs/routes.md` § « Correctif du
 * 2026-08-27 »).
 */
export const MEMO_ITEM_TITLE_MAX_LENGTH = 200
/** `MEMO_MAX_CHAPTERS_PER_STUDENT`. */
export const MEMO_MAX_CHAPTERS_PER_STUDENT = 50
/** `MEMO_MAX_ITEMS_PER_CHAPTER`. */
export const MEMO_MAX_ITEMS_PER_CHAPTER = 200
/**
 * `MEMO_IMAGE_MAX_BYTES` — 500 000 octets (500 Ko SI). Non paramétrable par
 * le TI pour l'instant : contrairement aux pièces jointes du cahier de texte,
 * ce chantier n'a pas demandé de réglage TI pour le Mémo.
 */
export const MEMO_IMAGE_MAX_BYTES = 500_000

/**
 * Types acceptés par `POST /memos/chapters/:chapterId/items/image` — liste
 * plus étroite que les pièces jointes du cahier de texte (pas de PDF/Office),
 * et **sans AVIF** contrairement à la photo de profil. SVG explicitement
 * refusé côté serveur (document XML exécutable).
 */
export const ACCEPTED_MEMO_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const MEMO_IMAGE_FILE_INPUT_ACCEPT = ACCEPTED_MEMO_IMAGE_MIME_TYPES.join(',')

// ─── Libellés ─────────────────────────────────────────────────────────────────

export const MEMO_ITEM_TYPE_LABELS = {
  text: 'Texte',
  formula: 'Formule',
  image: 'Image',
} as const

export const MEMO_LABELS = {
  pageTitle: 'Mémo',
  pageSubtitle: 'Vos notes personnelles structurées par chapitres',
  addChapter: '+ Chapitre',
  addItem: '+ Note',
  general: 'Général',
  emptyMemo: 'Aucune note dans le mémo',
  emptyChapter: 'Aucune note dans ce chapitre.',
  search: 'Rechercher',
  loading: 'Chargement du mémo…',
  readOnlyHint: 'Lecture seule — réservé à l\'élève',
} as const

/** « Taille maximale par image : 500 Ko. » */
export function getMemoImageMaxSizeHint(): string {
  return `Taille maximale par image : ${formatFileSize(MEMO_IMAGE_MAX_BYTES) ?? ''}.`
}

// ─── Validation locale avant envoi ────────────────────────────────────────────

/** Le fichier choisi dépasse-t-il le plafond ? Contrôlé avant tout appel réseau. */
export function isMemoImageTooLarge(file: File): boolean {
  return file.size > MEMO_IMAGE_MAX_BYTES
}

/** Message de refus pour une image trop lourde — contrôle local ou `413` serveur. */
export function getMemoImageTooLargeMessage(fileSizeBytes: number | null): string {
  const readableLimit = formatFileSize(MEMO_IMAGE_MAX_BYTES) ?? ''
  const readableFileSize = formatFileSize(fileSizeBytes)
  const firstSentence = readableFileSize
    ? `Cette image pèse ${readableFileSize}.`
    : 'Cette image est trop lourde pour être envoyée.'
  return `${firstSentence} La taille maximale est de ${readableLimit}. Choisissez une image plus légère.`
}

/**
 * MathLive (`MemoFormulaInput`) sérialise en LaTeX une case de gabarit non
 * remplie (ex. racine n-ième `\sqrt[n]{...}` insérée sans que `n` soit
 * renseigné) sous la forme `\placeholder{}` — syntaxe interne à MathLive,
 * jamais valide pour KaTeX en dehors de son propre éditeur. Détectée ici pour
 * bloquer l'enregistrement **avant** l'appel réseau, plutôt que de laisser le
 * repli « Formule illisible » de `MathRenderer` être le chemin normal d'une
 * simple case oubliée (défaut remonté par test utilisateur le 2026-08-27).
 */
const MATHLIVE_UNFILLED_PLACEHOLDER_PATTERN = /\\placeholder\{\}/

/** Une formule MathLive comporte-t-elle encore une case non remplie ? */
export function hasUnfilledMathPlaceholder(latex: string): boolean {
  return MATHLIVE_UNFILLED_PLACEHOLDER_PATTERN.test(latex)
}

/** Message affiché quand la soumission d'une formule incomplète est bloquée — jamais de LaTeX brut. */
export const MEMO_INCOMPLETE_FORMULA_MESSAGE =
  "Formule incomplète — un champ n'a pas été rempli."

// ─── Traduction des erreurs ────────────────────────────────────────────────────

const MEMO_UPLOAD_TOO_LARGE_CODE = 'UPLOAD_FILE_TOO_LARGE'

function isMemoImageUploadTooLargeError(error: unknown): boolean {
  if (getErrorStatus(error) !== 413) return false
  return readErrorPayload(error)?.code === MEMO_UPLOAD_TOO_LARGE_CODE
}

const MEMO_INVALID_IMAGE_MESSAGE =
  "Cette image n'a pas pu être envoyée : son format n'est pas reconnu ou n'est pas autorisé (JPEG, PNG, WebP ou GIF uniquement)."
const MEMO_FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à modifier ce mémo."
const MEMO_NOT_FOUND_MESSAGE = 'Ce chapitre ou cette note est introuvable.'
const MEMO_CHAPTER_LIMIT_MESSAGE =
  `Vous avez atteint le nombre maximal de chapitres (${MEMO_MAX_CHAPTERS_PER_STUDENT}). Supprimez-en un avant d'en créer un nouveau.`
const MEMO_ITEM_LIMIT_MESSAGE =
  `Ce chapitre a atteint le nombre maximal de notes (${MEMO_MAX_ITEMS_PER_CHAPTER}). Créez un nouveau chapitre.`
const MEMO_FALLBACK_MESSAGE = "L'action n'a pas pu être effectuée. Réessayez."

/** Traduit un échec d'écriture sur le mémo (chapitre ou item) en message affichable. */
export function getMemoWriteErrorMessage(error: unknown): string {
  const status = getErrorStatus(error)

  if (isMemoImageUploadTooLargeError(error)) {
    const payload = readErrorPayload(error)
    const receivedBytes = typeof payload?.receivedBytes === 'number' ? payload.receivedBytes : null
    return getMemoImageTooLargeMessage(receivedBytes)
  }

  if (status === 400) {
    const message = getErrorMessage(error, '')
    if (/chapitre/i.test(message) || /chapter/i.test(message)) return MEMO_CHAPTER_LIMIT_MESSAGE
    if (/item/i.test(message)) return MEMO_ITEM_LIMIT_MESSAGE
    return MEMO_INVALID_IMAGE_MESSAGE
  }
  if (status === 403) return MEMO_FORBIDDEN_MESSAGE
  if (status === 404) return MEMO_NOT_FOUND_MESSAGE

  return getErrorMessage(error, MEMO_FALLBACK_MESSAGE)
}

const MEMO_LOAD_FORBIDDEN_MESSAGE = "Vous n'avez pas accès au mémo de cette personne."
const MEMO_LOAD_FALLBACK_MESSAGE = "Le mémo n'a pas pu être chargé."

/** Traduit un échec de lecture du mémo (le sien ou celui d'un tiers relié). */
export function getMemoLoadErrorMessage(error: unknown): string {
  const status = getErrorStatus(error)
  if (status === 403) return MEMO_LOAD_FORBIDDEN_MESSAGE
  return getErrorMessage(error, MEMO_LOAD_FALLBACK_MESSAGE)
}
