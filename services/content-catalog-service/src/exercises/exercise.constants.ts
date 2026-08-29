/**
 * Plafonds et réglages de la refonte des Exercices — docs/architecture.md,
 * "Refonte des Exercices", session du 2026-08-29.
 *
 * Aucune liste/texte non bornée dans ce projet (convention déjà appliquée
 * partout ailleurs) : plafonds explicites plutôt que des tableaux illimités.
 */

/** Longueur maximale du contenu d'un item texte/formule, alignée sur les autres champs de texte long du projet. */
export const EXERCISE_ITEM_CONTENT_MAX_LENGTH = 5000;

/** Nombre maximal de blocs (statement + question) par exercice. */
export const EXERCISE_MAX_PARTS = 100;

/** Nombre maximal d'items (text/formula/image) par bloc ou par solution. */
export const EXERCISE_MAX_ITEMS_PER_PART = 50;

/**
 * Taille maximale d'une image d'exercice — même convention décimale que
 * l'avatar (2026-08-10) et les pièces jointes du cahier de texte
 * (2026-08-26) : "500 000 octets (500 Ko SI)", reprise de la valeur déjà
 * retenue pour les images du Mémo (même ordre de grandeur d'usage : une
 * illustration d'énoncé, pas une photo haute résolution).
 */
export const EXERCISE_IMAGE_MAX_BYTES = 500_000;

/** Liste blanche des types d'image acceptés — jamais une liste noire. */
export const EXERCISE_ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
