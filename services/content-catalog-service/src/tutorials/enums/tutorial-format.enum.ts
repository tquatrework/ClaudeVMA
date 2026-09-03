/**
 * Format d'un Tutoriel — refonte du 2026-09-03 (docs/architecture.md,
 * "Refonte des Tutos/Vidéos"). Remplace l'ancien couple `TutorialType`
 * (académie/activité/news) + `TutorialFormat` (texte/mixte/vidéo), retiré :
 * une seule entité `Tutorial`, deux formats exclusifs.
 *
 * `VIDEO` porte une URL d'embedding (`Tutorial.videoUrl`), `POST` porte une
 * séquence ordonnée de blocs (`TutorialBlock`) — jamais les deux à la fois,
 * vérifié côté service (`TutorialsService.validateFormatConsistency`).
 */
export enum TutorialFormat {
  VIDEO = 'video',
  POST = 'post',
}
