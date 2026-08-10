/**
 * Contraintes d'envoi de la photo de profil — **contrat serveur**, sans aucun
 * texte affiché (ceux-ci vivent dans `profileAvatar.ts`, point unique des
 * libellés de la photo).
 *
 * Le plafond et les formats viennent de `GET /profiles/avatar/constraints`
 * (`docs/routes.md` § « Photo de profil »). Ils **ne sont pas recopiés en dur**
 * dans le front : ils sortent de la même configuration que celle opposée à
 * l'envoi, et une copie divergerait au premier ajustement — on annoncerait alors
 * une limite fausse. La seule valeur figée ici est le repli, utilisé quand
 * l'appel échoue.
 */

import type { ProfileAvatarConstraints } from '../types/profile'

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

/**
 * Contraintes de repli, utilisées **uniquement** si
 * `GET /profiles/avatar/constraints` est injoignable ou renvoie un corps
 * inexploitable. Elles reprennent la configuration par défaut du serveur au
 * 2026-08-10. Ce n'est pas une référence : dès que l'appel aboutit, ce sont les
 * valeurs du serveur qui s'appliquent, y compris le jour où le plafond sera
 * relevé.
 */
export const FALLBACK_AVATAR_CONSTRAINTS: ProfileAvatarConstraints = {
  maxUploadBytes: 1_000_000,
  acceptedContentTypes: [...ACCEPTED_AVATAR_MIME_TYPES],
  outputContentType: 'image/webp',
  maxDimensionPixels: 512,
}

/**
 * Lit un nombre strictement positif, ou `null`.
 *
 * Garde appliquée à **tout** nombre venu du réseau dans ce domaine : plafond
 * annoncé, `receivedBytes` d'un `413` (qui vaut légitimement `null`), taille
 * d'image. Sans elle, une valeur absente ou textuelle produirait « NaN Mo » à
 * l'écran et une comparaison de taille toujours fausse.
 */
export function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Complète une réponse partielle ou malformée par le repli, champ par champ.
 *
 * Sans ce garde-fou, un corps incomplet ferait comparer chaque fichier à
 * `undefined` — c'est-à-dire n'en refuserait aucun localement — et afficherait
 * une limite illisible.
 */
export function normalizeAvatarConstraints(raw: unknown): ProfileAvatarConstraints {
  const candidate = (raw ?? {}) as Partial<ProfileAvatarConstraints>

  const acceptedContentTypes =
    Array.isArray(candidate.acceptedContentTypes) &&
    candidate.acceptedContentTypes.length > 0 &&
    candidate.acceptedContentTypes.every((contentType) => typeof contentType === 'string')
      ? candidate.acceptedContentTypes
      : FALLBACK_AVATAR_CONSTRAINTS.acceptedContentTypes

  return {
    maxUploadBytes:
      readPositiveNumber(candidate.maxUploadBytes) ?? FALLBACK_AVATAR_CONSTRAINTS.maxUploadBytes,
    acceptedContentTypes,
    outputContentType:
      typeof candidate.outputContentType === 'string' && candidate.outputContentType.length > 0
        ? candidate.outputContentType
        : FALLBACK_AVATAR_CONSTRAINTS.outputContentType,
    maxDimensionPixels:
      readPositiveNumber(candidate.maxDimensionPixels) ??
      FALLBACK_AVATAR_CONSTRAINTS.maxDimensionPixels,
  }
}

/** Valeur de l'attribut `accept` du champ de fichier, d'après les contraintes lues. */
export function buildAvatarFileInputAccept(acceptedContentTypes: readonly string[]): string {
  return acceptedContentTypes.join(',')
}

/** Repli de l'attribut `accept`, avant que les contraintes soient connues. */
export const AVATAR_FILE_INPUT_ACCEPT = buildAvatarFileInputAccept(ACCEPTED_AVATAR_MIME_TYPES)

/**
 * Le fichier choisi dépasse-t-il le plafond ? Contrôlé **avant** tout appel
 * réseau : envoyer 5 Mo pour se les faire refuser fait patienter l'utilisateur
 * pour rien — plusieurs dizaines de secondes en 4G.
 */
export function isAvatarFileTooLarge(file: File, maxUploadBytes: number): boolean {
  return file.size > maxUploadBytes
}
