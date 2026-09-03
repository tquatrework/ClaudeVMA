/**
 * Catégorie d'un bloc de Tutoriel au format `post` — refonte du 2026-09-03
 * (docs/architecture.md, "Refonte des Tutos/Vidéos"), sur le même schéma que
 * la séquence de blocs déjà construite pour l'Exercice (`ExercisePartCategory`,
 * 2026-08-29 puis 2026-09-01) : une séquence ORDONNÉE de blocs typés,
 * librement entrelacés, sans structure d'items imbriqués (contrairement à
 * l'Exercice, un bloc EST directement son contenu — un simple champ texte
 * suffit pour `text`, une image pour `image`).
 *
 * `TITLE` a été retiré et fusionné dans `TEXT` — révision du 2026-09-03
 * ("Éditeur riche (WYSIWYG) pour les blocs texte du Tutoriel 'post'",
 * docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md) :
 * un titre devient un texte affiché en grande taille/gras via l'éditeur
 * riche front, plutôt qu'une catégorie de bloc distincte portant le même
 * besoin par un mécanisme différent. Toute donnée existante en base sous
 * `title` a été migrée vers `text` par la migration
 * `RemoveTutorialBlockTitleCategory1801000000000`.
 *
 * `TEXT` porte désormais un document structuré dans `TutorialBlock.content`
 * (le format propre à l'éditeur riche choisi côté front, ex. TipTap/
 * ProseMirror) plutôt que du texte brut avec syntaxe légère — ce champ reste
 * une donnée opaque pour ce service, aucun parsing/validation de structure
 * n'est fait ici, seule sa taille est plafonnée
 * (`TUTORIAL_BLOCK_CONTENT_MAX_LENGTH`). C'est l'unique exception du projet
 * à la syntaxe légère texte brut ($...$/$$...$$, `[label](url)`) posée le
 * 2026-08-26 — Memo, Quizz et cahier de texte gardent cette syntaxe légère,
 * leur besoin n'a pas changé. `IMAGE` réutilise le même mécanisme d'upload
 * que le bloc image de premier niveau de l'Exercice (base64 inline,
 * ré-encodage, SVG refusé — arbitrage du 2026-09-01), inchangé par cette
 * révision.
 */
export enum TutorialBlockCategory {
  TEXT = 'text',
  IMAGE = 'image',
}
