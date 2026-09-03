export enum ContentType {
  EXERCISE = 'exercise',
  EVALUATION = 'evaluation',
  TUTORIAL = 'tutorial',
  QUIZ = 'quiz',
}

// TutorialType / TutorialFormat (académie/activité/news, texte/mixte/vidéo)
// retirés le 2026-09-03 (docs/architecture.md, "Refonte des Tutos/Vidéos") —
// remplacés par `TutorialFormat` (video/post), voir
// `../../tutorials/enums/tutorial-format.enum.ts`.
