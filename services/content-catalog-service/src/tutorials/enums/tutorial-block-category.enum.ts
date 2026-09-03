/**
 * Catégorie d'un bloc de Tutoriel au format `post` — refonte du 2026-09-03
 * (docs/architecture.md, "Refonte des Tutos/Vidéos"), sur le même schéma que
 * la séquence de blocs déjà construite pour l'Exercice (`ExercisePartCategory`,
 * 2026-08-29 puis 2026-09-01) : une séquence ORDONNÉE de blocs typés,
 * librement entrelacés, sans structure d'items imbriqués (contrairement à
 * l'Exercice, un bloc EST directement son contenu — un simple champ texte
 * suffit pour `title`/`text`, une image pour `image`).
 *
 * `TITLE` et `TEXT` portent du texte brut dans `TutorialBlock.content`, avec
 * la syntaxe légère déjà en place dans le projet ($...$/$$...$$ pour les
 * formules KaTeX, `[label](url)` pour un lien — arbitrage du 2026-08-26),
 * rendue côté client uniquement. `IMAGE` réutilise le même mécanisme
 * d'upload que le bloc image de premier niveau de l'Exercice (base64
 * inline, ré-encodage, SVG refusé — arbitrage du 2026-09-01).
 */
export enum TutorialBlockCategory {
  TITLE = 'title',
  TEXT = 'text',
  IMAGE = 'image',
}
