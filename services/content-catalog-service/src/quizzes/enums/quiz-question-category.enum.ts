export enum QuizQuestionCategory {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  SHORT_TEXT = 'short_text',
}

/**
 * Notation des questions à choix multiples :
 *  - ALL_OR_NOTHING : juste seulement si toutes les cases attendues sont
 *    cochées et aucune autre.
 *  - PER_OPTION : chaque case correctement traitée rapporte des points,
 *    indépendamment des autres.
 */
export enum MultipleChoiceScoringMode {
  ALL_OR_NOTHING = 'all_or_nothing',
  PER_OPTION = 'per_option',
}

/**
 * Notation des questions à texte court :
 *  - ALL_OR_NOTHING : juste seulement si tous les mots-clés attendus sont
 *    présents.
 *  - PER_KEYWORD : chaque mot-clé présent rapporte des points.
 */
export enum ShortTextScoringMode {
  ALL_OR_NOTHING = 'all_or_nothing',
  PER_KEYWORD = 'per_keyword',
}
