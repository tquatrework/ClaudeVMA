/**
 * Plafonds et réglages de la refonte des Tutos/Vidéos — docs/architecture.md,
 * "Refonte des Tutos/Vidéos", session du 2026-09-03.
 *
 * Aucune liste/texte non bornée dans ce projet (convention déjà appliquée
 * partout ailleurs) : plafonds explicites plutôt que des tableaux illimités.
 */

/**
 * Longueur maximale du contenu d'un bloc `text` — relevée le 2026-09-03
 * (docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md,
 * "Éditeur riche (WYSIWYG)...", point 3) : ce champ portait du texte brut
 * avec syntaxe légère (plafond initial 5000, aligné sur
 * `EXERCISE_ITEM_CONTENT_MAX_LENGTH`), il porte désormais un document
 * structuré (JSON de l'éditeur riche front, ex. TipTap/ProseMirror) pour un
 * même contenu visible. Le format JSON à nœuds/marques ajoute un surcoût
 * structurel significatif (enveloppe de chaque paragraphe/marque/nœud
 * inline) par rapport au texte brut équivalent — 20 000 caractères
 * (facteur ~4x) laisse une marge raisonnable pour un bloc de texte
 * richement formaté sans devenir un champ non borné. Reste très en-dessous
 * du plafond de corps JSON entier (`TUTORIAL_JSON_BODY_MAX_BYTES`,
 * 900 000 octets, partagé avec les blocs image) qui plafonne de toute façon
 * l'agrégat d'une requête entière — ce plafond par bloc est une défense en
 * profondeur, pas la seule limite.
 *
 * Aucune validation de structure interne n'est ajoutée : le service ne
 * connaît pas la forme du document riche, seule sa taille est bornée.
 */
export const TUTORIAL_BLOCK_CONTENT_MAX_LENGTH = 20_000;

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
