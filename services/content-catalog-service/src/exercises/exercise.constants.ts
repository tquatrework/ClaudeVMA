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

/**
 * Plafonds introduits le 2026-09-01 (docs/architecture.md, "Bloc 'image' de
 * premier niveau pour l'Exercice") — les images d'exercice s'embarquent
 * désormais en base64 DANS le corps JSON de POST/PUT /exercises (ancien
 * mécanisme multipart post-création retiré), ce qui change radicalement la
 * contrainte de taille : le corps entier doit rester sous le défaut NON
 * déclaré de nginx-global (1 Mio = 1 048 576 octets, vérifié le 2026-09-01
 * par `nginx -T` sur le conteneur réel — aucune directive
 * `client_max_body_size` nulle part dans sa configuration), qui reste hors
 * dépôt et ne peut pas être relevé sans reconstruire tous les sites qu'il
 * héberge. Même raisonnement que `QUIZ_IMPORT_MAX_FILE_SIZE_BYTES`
 * (2026-08-29, 900 000 octets).
 */

/**
 * Taille maximale d'une image en ENTRÉE (avant ré-encodage), décodée depuis
 * `imageData` (base64) — nettement plus bas que l'ancien plafond multipart
 * (qui autorisait jusqu'à 2 Mo bruts, jamais éprouvé contre le vrai
 * nginx-global) : une seule image à ce plafond occupe déjà l'essentiel du
 * budget du corps JSON ci-dessous.
 */
export const EXERCISE_IMAGE_INPUT_MAX_BYTES = 600_000;

/**
 * Longueur maximale de la chaîne base64 `imageData` — dérivée de
 * `EXERCISE_IMAGE_INPUT_MAX_BYTES` (facteur 4/3 de l'encodage base64), avec
 * une marge pour un éventuel préfixe data URI (`data:image/...;base64,`).
 * Vérification de défense en profondeur au niveau du DTO ; la vérification
 * réelle porte sur les octets décodés (voir `ExercisesService`).
 */
export const EXERCISE_IMAGE_BASE64_MAX_LENGTH = 820_000;

/**
 * Plafond du corps JSON entier de POST/PUT /exercises, appliqué explicitement
 * dans `main.ts` (Express applique sinon son propre défaut de 100 Ko, très en
 * dessous du besoin d'une seule image encodée). Volontairement sous le
 * défaut non déclaré de nginx-global (1 Mio), avec marge pour la structure
 * JSON (titre, tags, plusieurs blocs texte/formule).
 */
export const EXERCISE_JSON_BODY_MAX_BYTES = 900_000;
