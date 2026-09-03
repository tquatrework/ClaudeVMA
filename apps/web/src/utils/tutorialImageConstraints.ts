/**
 * tutorialImageConstraints.ts — contrainte de taille pour un bloc image de Tutoriel, lue au
 * serveur (`GET /tutorials/image-constraints`). Même discipline et mêmes valeurs de repli que
 * `exerciseImageConstraints.ts` — `content-catalog-service` réutilise littéralement
 * `ExerciseImageStorageService`/`ExerciseImageTranscoder` pour les deux types de contenu, la
 * limite s'annonce **avant** que l'utilisateur choisisse un fichier, et un fichier trop lourd est
 * refusé **localement**, avant tout envoi.
 */

import { formatFileSize } from './fileSize'
import { readPositiveNumber } from './profileAvatarConstraints'
import type { TutorialImageConstraints } from '../types/tutorial'

/**
 * Repli utilisé uniquement si `GET /tutorials/image-constraints` est injoignable ou renvoie un
 * corps inexploitable — mêmes valeurs que `FALLBACK_EXERCISE_IMAGE_CONSTRAINTS` (même
 * transcodeur réutilisé côté serveur). Dès que l'appel aboutit, ce sont les valeurs serveur qui
 * priment.
 */
export const FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS: TutorialImageConstraints = {
  maxImageInputBytes: 600_000,
  maxImageOutputBytes: 500_000,
  maxRequestBodyBytes: 900_000,
}

/** Complète une réponse partielle ou malformée par le repli, champ par champ. */
export function normalizeTutorialImageConstraints(raw: unknown): TutorialImageConstraints {
  const candidate = (raw ?? {}) as Partial<TutorialImageConstraints>
  return {
    maxImageInputBytes:
      readPositiveNumber(candidate.maxImageInputBytes) ??
      FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS.maxImageInputBytes,
    maxImageOutputBytes:
      readPositiveNumber(candidate.maxImageOutputBytes) ??
      FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS.maxImageOutputBytes,
    maxRequestBodyBytes:
      readPositiveNumber(candidate.maxRequestBodyBytes) ??
      FALLBACK_TUTORIAL_IMAGE_CONSTRAINTS.maxRequestBodyBytes,
  }
}

/** « Taille maximale : 600 Ko. » — affiché sous le sélecteur de fichier, avant tout choix. */
export function getTutorialImageMaxSizeHint(maxImageInputBytes: number): string {
  const readableLimit = formatFileSize(maxImageInputBytes) ?? ''
  return `Taille maximale : ${readableLimit}.`
}

/** Le fichier choisi dépasse-t-il le plafond ? Contrôlé avant tout envoi. */
export function isTutorialImageFileTooLarge(file: File, maxImageInputBytes: number): boolean {
  return file.size > maxImageInputBytes
}

export function getTutorialImageTooLargeMessage(file: File, maxImageInputBytes: number): string {
  const readableLimit = formatFileSize(maxImageInputBytes) ?? ''
  const readableFileSize = formatFileSize(file.size) ?? 'une taille inconnue'
  return `Cette image pèse ${readableFileSize}. La taille maximale acceptée est de ${readableLimit}. Choisissez une image plus légère.`
}

/**
 * Le corps JSON entier de la requête dépasse-t-il le plafond applicatif ? Vérifié après
 * construction du payload complet — un tutoriel à plusieurs blocs image peut dépasser le plafond
 * même si chaque image prise isolément est sous la limite.
 */
export function isTutorialRequestBodyTooLarge(
  serializedPayload: string,
  maxRequestBodyBytes: number,
): boolean {
  return new Blob([serializedPayload]).size > maxRequestBodyBytes
}

export function getTutorialRequestBodyTooLargeMessage(maxRequestBodyBytes: number): string {
  const readableLimit = formatFileSize(maxRequestBodyBytes) ?? ''
  return `Le contenu de ce tutoriel (texte et images) dépasse la taille maximale acceptée (${readableLimit}). Retirez ou allégez une image, ou scindez le tutoriel.`
}
