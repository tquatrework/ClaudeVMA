/**
 * Plafonds et réglages de la refonte des Tutos/Vidéos — docs/architecture.md,
 * "Refonte des Tutos/Vidéos", session du 2026-09-03.
 *
 * Aucune liste/texte non bornée dans ce projet (convention déjà appliquée
 * partout ailleurs) : plafonds explicites plutôt que des tableaux illimités.
 */

/** Longueur maximale du contenu d'un bloc titre/texte, alignée sur l'item d'Exercice (`EXERCISE_ITEM_CONTENT_MAX_LENGTH`). */
export const TUTORIAL_BLOCK_CONTENT_MAX_LENGTH = 5000;

/** Longueur maximale de la description courte du Tutoriel — champ nouveau pour ce type (2026-09-03), sans contrainte métier particulière au-delà d'un plafond de texte long, comme partout ailleurs dans ce projet. */
export const TUTORIAL_DESCRIPTION_MAX_LENGTH = 2000;

/** Nombre maximal de blocs par Tutoriel au format `post`. */
export const TUTORIAL_MAX_BLOCKS = 100;

/** Longueur maximale de l'URL vidéo (format `video`). */
export const TUTORIAL_VIDEO_URL_MAX_LENGTH = 2048;

/**
 * Le plafond de corps JSON (`EXERCISE_JSON_BODY_MAX_BYTES`) est déjà appliqué
 * GLOBALEMENT dans `main.ts` (`app.use(json({ limit: ... }))`, posé pour
 * `POST`/`PUT /exercises`) — il couvre donc déjà `POST`/`PUT /tutorials` sans
 * modification de `main.ts`. Ce service réutilise directement les mêmes
 * plafonds d'image (même volume Docker, même transcodeur — voir
 * `TutorialsModule`, qui importe `ExercisesModule` pour partager
 * `ExerciseImageStorageService`/`ExerciseImageTranscoder` plutôt que d'en
 * réécrire un second, comme demandé par l'arbitrage) plutôt que d'en
 * redéfinir de nouveaux.
 */
export { EXERCISE_IMAGE_MAX_BYTES as TUTORIAL_IMAGE_MAX_BYTES } from '../exercises/exercise.constants';
export { EXERCISE_IMAGE_INPUT_MAX_BYTES as TUTORIAL_IMAGE_INPUT_MAX_BYTES } from '../exercises/exercise.constants';
export { EXERCISE_IMAGE_BASE64_MAX_LENGTH as TUTORIAL_IMAGE_BASE64_MAX_LENGTH } from '../exercises/exercise.constants';
export { EXERCISE_JSON_BODY_MAX_BYTES as TUTORIAL_JSON_BODY_MAX_BYTES } from '../exercises/exercise.constants';
