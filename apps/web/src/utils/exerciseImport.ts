/**
 * Import d'Exercices depuis un tableur — helpers purs et **point unique** des
 * textes affichés (`docs/architecture.md` > « Import d'Exercice depuis un tableur
 * (CSV/Excel), et modèle de type identique pour l'import de Quizz », arbitrage du
 * 2026-09-02). Même discipline que `quizImport.ts` : messages traduits par
 * intention, jamais affichés tels quels ; la limite d'envoi ne vient jamais d'une
 * constante recopiée en dur.
 */

import { formatFileSize } from './fileSize'
import { getErrorMessage, getErrorStatus, readErrorPayload } from './apiError'
import { readPositiveNumber } from './profileAvatarConstraints'
import type { ExerciseImportBlockStatus, ExerciseImportConstraints } from '../types/exercise'

export const EXERCISE_IMPORT_LABELS = {
  triggerAction: 'Importer des Exercices',
  modalTitle: 'Importer des Exercices depuis un fichier',
  fileInputLabel: 'Fichier à importer (.csv ou .xlsx)',
  changeFileAction: 'Choisir un autre fichier',
  submitAction: 'Importer',
  submitting: 'Import en cours…',
  cancelAction: 'Annuler',
  resultsTitle: "Résultat de l'import",
  closeResultsAction: 'Fermer',
  createdStatusLabel: 'Créé',
  errorStatusLabel: 'Non importé',
} as const

export const EXERCISE_IMPORT_BLOCK_STATUS_LABELS: Record<ExerciseImportBlockStatus, string> = {
  created: 'Créé',
  error: 'Non importé',
}

export const EXERCISE_IMPORT_BLOCK_STATUS_BADGE_CLASSES: Record<ExerciseImportBlockStatus, string> = {
  created: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

/** Extensions acceptées, en minuscules, point compris. */
export const ACCEPTED_EXERCISE_IMPORT_EXTENSIONS = ['.csv', '.xlsx'] as const

/** Valeur de l'attribut `accept` du sélecteur de fichier. */
export const EXERCISE_IMPORT_FILE_INPUT_ACCEPT = ACCEPTED_EXERCISE_IMPORT_EXTENSIONS.join(',')

/**
 * Contraintes de repli, utilisées **uniquement** si
 * `GET /exercises/import/constraints` est injoignable ou renvoie un corps
 * inexploitable. Même valeur de repli que l'import Quizz (900 Ko), sous le défaut
 * non déclaré de `nginx-global` (1 Mio).
 */
export const FALLBACK_EXERCISE_IMPORT_CONSTRAINTS: ExerciseImportConstraints = {
  maxFileSizeBytes: 900_000,
}

/** Complète une réponse partielle ou malformée par le repli, champ par champ. */
export function normalizeExerciseImportConstraints(raw: unknown): ExerciseImportConstraints {
  const candidate = (raw ?? {}) as Partial<ExerciseImportConstraints>
  return {
    maxFileSizeBytes:
      readPositiveNumber(candidate.maxFileSizeBytes) ??
      FALLBACK_EXERCISE_IMPORT_CONSTRAINTS.maxFileSizeBytes,
  }
}

/** « Taille maximale du fichier : 900 Ko. Formats acceptés : .csv, .xlsx. » */
export function getExerciseImportMaxSizeHint(maxFileSizeBytes: number): string {
  const readableLimit = formatFileSize(maxFileSizeBytes) ?? ''
  return `Taille maximale du fichier : ${readableLimit}. Formats acceptés : .csv, .xlsx.`
}

/** Le nom de fichier porte-t-il une extension acceptée ? Confort seulement — le serveur détecte le type sur les octets réels. */
export function hasAcceptedExerciseImportExtension(fileName: string): boolean {
  const lowerCaseFileName = fileName.toLowerCase()
  return ACCEPTED_EXERCISE_IMPORT_EXTENSIONS.some((extension) =>
    lowerCaseFileName.endsWith(extension),
  )
}

export function getExerciseImportWrongExtensionMessage(fileName: string): string {
  return `« ${fileName} » n'est pas un fichier .csv ou .xlsx. Choisissez un fichier dans l'un de ces deux formats.`
}

/** Le fichier choisi dépasse-t-il le plafond ? Contrôlé avant tout appel réseau. */
export function isExerciseImportFileTooLarge(file: File, maxFileSizeBytes: number): boolean {
  return file.size > maxFileSizeBytes
}

export function getExerciseImportTooLargeMessage(
  fileSizeBytes: number | null,
  maxFileSizeBytes: number,
): string {
  const readableLimit = formatFileSize(maxFileSizeBytes) ?? ''
  const readableFileSize = formatFileSize(fileSizeBytes)

  const firstSentence = readableFileSize
    ? `Ce fichier pèse ${readableFileSize}.`
    : 'Ce fichier est trop volumineux pour être importé.'

  return `${firstSentence} La taille maximale acceptée est de ${readableLimit}. Choisissez un fichier plus léger, ou scindez l'import en plusieurs fichiers.`
}

// ─── Traduction des erreurs d'envoi ────────────────────────────────────────────

const IMPORT_INVALID_FILE_MESSAGE =
  "Ce fichier n'a pas pu être importé : son format n'est pas reconnu, ou son contenu ne correspond pas au modèle attendu."
const IMPORT_FORBIDDEN_MESSAGE = "Vous n'êtes pas autorisé à importer des Exercices."
const IMPORT_SERVER_MESSAGE = "L'import n'a pas pu être traité. Réessayez dans quelques instants."
const IMPORT_FALLBACK_MESSAGE = "L'import n'a pas pu être envoyé. Réessayez."

export interface ExerciseImportUploadErrorContext {
  /** Plafond lu sur les contraintes, si l'appel a abouti. */
  maxFileSizeBytes?: number
  /** `File.size` du fichier tenté — le front le connaît toujours. */
  attemptedFileSizeBytes?: number
}

/** Traduit un échec d'import en message affichable. */
export function getExerciseImportUploadErrorMessage(
  error: unknown,
  context: ExerciseImportUploadErrorContext = {},
): string {
  const status = getErrorStatus(error)

  if (status === 413) {
    const payload = readErrorPayload(error)
    const maxFileSizeBytes =
      readPositiveNumber((payload as { maxUploadBytes?: number } | undefined)?.maxUploadBytes) ??
      readPositiveNumber(context.maxFileSizeBytes) ??
      FALLBACK_EXERCISE_IMPORT_CONSTRAINTS.maxFileSizeBytes
    const attemptedFileSizeBytes = readPositiveNumber(context.attemptedFileSizeBytes)
    return getExerciseImportTooLargeMessage(attemptedFileSizeBytes, maxFileSizeBytes)
  }

  if (status === 400) return IMPORT_INVALID_FILE_MESSAGE
  if (status === 403) return IMPORT_FORBIDDEN_MESSAGE
  if (status !== undefined && status >= 500) return IMPORT_SERVER_MESSAGE

  return getErrorMessage(error, IMPORT_FALLBACK_MESSAGE)
}

/** « Exercice n°3 » — repli quand le titre n'a pas pu être relu après création. */
export function getExerciseImportBlockFallbackLabel(blockIndex: number): string {
  return `Exercice n°${blockIndex + 1} du fichier`
}
