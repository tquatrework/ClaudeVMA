/**
 * exerciseImageConstraints.ts — contrainte de taille pour les blocs image d'un Exercice, lue au
 * serveur (`GET /exercises/image-constraints`, ajoutée le 2026-09-01). Même discipline que
 * `profileAvatarConstraints.ts` : la limite s'annonce **avant** que l'utilisateur choisisse un
 * fichier, et un fichier trop lourd est refusé **localement**, avant tout envoi.
 */

import { formatFileSize } from './fileSize'
import { readPositiveNumber } from './profileAvatarConstraints'
import type { ExerciseImageConstraints } from '../types/exercise'

/**
 * Repli utilisé uniquement si `GET /exercises/image-constraints` est injoignable ou renvoie un
 * corps inexploitable — reprend les valeurs communiquées par `content-catalog-service` (PR #191)
 * au 2026-09-01. Dès que l'appel aboutit, ce sont les valeurs serveur qui priment.
 */
export const FALLBACK_EXERCISE_IMAGE_CONSTRAINTS: ExerciseImageConstraints = {
  maxImageInputBytes: 600_000,
  maxImageOutputBytes: 500_000,
  maxRequestBodyBytes: 900_000,
}

/** Complète une réponse partielle ou malformée par le repli, champ par champ. */
export function normalizeExerciseImageConstraints(raw: unknown): ExerciseImageConstraints {
  const candidate = (raw ?? {}) as Partial<ExerciseImageConstraints>
  return {
    maxImageInputBytes:
      readPositiveNumber(candidate.maxImageInputBytes) ??
      FALLBACK_EXERCISE_IMAGE_CONSTRAINTS.maxImageInputBytes,
    maxImageOutputBytes:
      readPositiveNumber(candidate.maxImageOutputBytes) ??
      FALLBACK_EXERCISE_IMAGE_CONSTRAINTS.maxImageOutputBytes,
    maxRequestBodyBytes:
      readPositiveNumber(candidate.maxRequestBodyBytes) ??
      FALLBACK_EXERCISE_IMAGE_CONSTRAINTS.maxRequestBodyBytes,
  }
}

/** « Taille maximale : 600 Ko. » — affiché sous le sélecteur de fichier, avant tout choix. */
export function getExerciseImageMaxSizeHint(maxImageInputBytes: number): string {
  const readableLimit = formatFileSize(maxImageInputBytes) ?? ''
  return `Taille maximale : ${readableLimit}.`
}

/** Le fichier choisi dépasse-t-il le plafond ? Contrôlé avant tout envoi. */
export function isExerciseImageFileTooLarge(file: File, maxImageInputBytes: number): boolean {
  return file.size > maxImageInputBytes
}

export function getExerciseImageTooLargeMessage(file: File, maxImageInputBytes: number): string {
  const readableLimit = formatFileSize(maxImageInputBytes) ?? ''
  const readableFileSize = formatFileSize(file.size) ?? 'une taille inconnue'
  return `Cette image pèse ${readableFileSize}. La taille maximale acceptée est de ${readableLimit}. Choisissez une image plus légère.`
}

/**
 * Le corps JSON entier de la requête dépasse-t-il le plafond applicatif ? Vérifié après
 * construction du payload complet — un exercice à plusieurs blocs image peut dépasser le plafond
 * même si chaque image prise isolément est sous la limite.
 */
export function isExerciseRequestBodyTooLarge(
  serializedPayload: string,
  maxRequestBodyBytes: number,
): boolean {
  return new Blob([serializedPayload]).size > maxRequestBodyBytes
}

export function getExerciseRequestBodyTooLargeMessage(maxRequestBodyBytes: number): string {
  const readableLimit = formatFileSize(maxRequestBodyBytes) ?? ''
  return `Le contenu de cet exercice (texte et images) dépasse la taille maximale acceptée (${readableLimit}). Retirez ou allégez une image, ou scindez l'exercice.`
}
