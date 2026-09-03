/**
 * Point unique de correspondance statut/catégorie/format technique → libellé français, pour le
 * Tutoriel. Même modèle que `exerciseLabels.ts`/`quizLabels.ts` (règle de langue du 2026-08-09).
 */

import type { TutorialBlockCategory, TutorialFormat, TutorialStatus } from '../types/tutorial'

export const TUTORIAL_STATUS_LABELS: Record<TutorialStatus, string> = {
  pending_validation: 'En attente de validation',
  validated: 'Validé',
  rejected: 'Refusé',
}

export const TUTORIAL_STATUS_BADGE_CLASSES: Record<TutorialStatus, string> = {
  pending_validation: 'bg-orange-100 text-orange-700',
  validated: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const TUTORIAL_FORMAT_LABELS: Record<TutorialFormat, string> = {
  video: 'Vidéo',
  post: 'Article (texte et images)',
}

export const TUTORIAL_BLOCK_CATEGORY_LABELS: Record<TutorialBlockCategory, string> = {
  text: 'Texte',
  image: 'Image',
}
