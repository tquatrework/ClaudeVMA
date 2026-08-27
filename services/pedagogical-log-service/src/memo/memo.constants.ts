/**
 * Plafonds du Mémo élève — chantier feat/memo-formules (assainissement
 * backend, B4). Aucune liste/texte non bornée dans ce projet — convention
 * déjà appliquée partout ailleurs (docs/architecture.md).
 *
 * Valeurs choisies, documentées dans le rapport de session :
 * - Longueur de `content` (texte/formule) : alignée sur les autres champs de
 *   texte long du projet (`description`/`message` de teacher-request-service,
 *   `comment` de profile-service) : 5000 caractères.
 * - Longueur de `title` d'item (texte/formule/image, tous optionnels) :
 *   alignée sur `MEMO_CHAPTER_TITLE_MAX_LENGTH` (200 caractères) — même
 *   nature de donnée (un titre court), même plafond. Ajoutée le 2026-08-27
 *   suite à une régression signalée par l'utilisateur : l'ancien modèle plat
 *   `Memo` (avant l'assainissement du 2026-08-27) portait un `title`
 *   optionnel, jamais repris par la migration `CreateMemoTables` — un titre
 *   envoyé à la création était donc silencieusement absorbé sans effet
 *   (`ValidationPipe({whitelist:true})` sans `forbidNonWhitelisted`, aucune
 *   propriété `title` sur le DTO). Corrigé ici.
 * - Nombre de chapitres par élève / items par chapitre : reprend les valeurs
 *   proposées par le plan de chantier (50 / 200) — assez large pour un usage
 *   réel, borné pour éviter une liste non bornée.
 * - Taille d'une image : 500 000 octets (500 Ko SI), reprise de l'ancienne
 *   doc aspirationnelle du service (XML spec functionality 004 : "images
 *   limitées en taille"). Non paramétrable par le TI pour l'instant — à la
 *   différence des pièces jointes du cahier de texte (arbitrage du
 *   2026-08-26), ce chantier n'a pas demandé de réglage TI pour le Mémo ;
 *   à revoir si le besoin apparaît.
 */
export const MEMO_ITEM_CONTENT_MAX_LENGTH = 5000;
export const MEMO_ITEM_TITLE_MAX_LENGTH = 200;
export const MEMO_CHAPTER_TITLE_MAX_LENGTH = 200;
export const MEMO_MAX_CHAPTERS_PER_STUDENT = 50;
export const MEMO_MAX_ITEMS_PER_CHAPTER = 200;
export const MEMO_IMAGE_MAX_BYTES = 500_000;

/** Liste blanche des types d'image acceptés pour un item `image` — jamais une liste noire. */
export const MEMO_ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
