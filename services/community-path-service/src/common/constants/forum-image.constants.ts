/**
 * Contraintes de l'image d'illustration d'un forum (arbitrage du 2026-09-04).
 *
 * Plafond fixé à 1 000 000 octets (1 Mo SI), même valeur et même motif que
 * l'avatar de profil (2026-08-10) : rester strictement sous le défaut non
 * déclaré de 1 Mio de nginx-global, dont la reconstruction est hors de
 * portée courante. Exposé par `GET /forums/image-constraints`, lu par le
 * front avant l'affichage du sélecteur de fichier — jamais codé en dur
 * côté client.
 */
export const FORUM_IMAGE_MAX_SIZE_BYTES = 1_000_000;

/**
 * Types MIME acceptés, détectés sur les octets réels via `sharp` (jamais sur
 * l'extension ni le `Content-Type` envoyé par le client). SVG explicitement
 * refusé (format exécutable) — même règle que partout ailleurs dans ce
 * projet.
 */
export const FORUM_IMAGE_ALLOWED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Dimension maximale (plus grand côté) après réencodage, sans agrandissement
 * d'une image plus petite.
 */
export const FORUM_IMAGE_MAX_DIMENSION_PX = 1200;
