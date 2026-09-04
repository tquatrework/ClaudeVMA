/**
 * Contraintes d'envoi de l'image d'illustration d'un forum — contrat serveur, sans texte affiché
 * (les libellés vivent dans `forumLabels.ts`). Même patron que `profileAvatarConstraints.ts`.
 *
 * Le plafond et les formats viennent de `GET /forums/image-constraints`
 * (`docs/routes.md` § « Image d'illustration »). Jamais recopiés en dur : seul le repli ci-dessous
 * est figé, utilisé quand l'appel échoue.
 */

import type { ForumImageConstraints } from '../types/forum'
import { readPositiveNumber } from './profileAvatarConstraints'

/** Même plafond et mêmes formats que l'avatar de profil au 2026-09-04 (1 Mo SI). */
export const FALLBACK_FORUM_IMAGE_CONSTRAINTS: ForumImageConstraints = {
  maxSizeBytes: 1_000_000,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}

/** Complète une réponse partielle ou malformée par le repli, champ par champ. */
export function normalizeForumImageConstraints(raw: unknown): ForumImageConstraints {
  const candidate = (raw ?? {}) as Partial<ForumImageConstraints>

  const allowedMimeTypes =
    Array.isArray(candidate.allowedMimeTypes) &&
    candidate.allowedMimeTypes.length > 0 &&
    candidate.allowedMimeTypes.every((mimeType) => typeof mimeType === 'string')
      ? candidate.allowedMimeTypes
      : FALLBACK_FORUM_IMAGE_CONSTRAINTS.allowedMimeTypes

  return {
    maxSizeBytes:
      readPositiveNumber(candidate.maxSizeBytes) ?? FALLBACK_FORUM_IMAGE_CONSTRAINTS.maxSizeBytes,
    allowedMimeTypes,
  }
}

/** Valeur de l'attribut `accept` du champ de fichier, d'après les contraintes lues. */
export function buildForumImageFileInputAccept(allowedMimeTypes: readonly string[]): string {
  return allowedMimeTypes.join(',')
}

/** Le fichier choisi dépasse-t-il le plafond ? Contrôlé avant tout appel réseau. */
export function isForumImageFileTooLarge(file: File, maxSizeBytes: number): boolean {
  return file.size > maxSizeBytes
}
