import { CreateQuizDto } from './create-quiz.dto';

/**
 * Corps de PUT /quizzes/:id — même forme que POST /quizzes (arbitrage du
 * 2026-08-28, "Edition d'un Quizz par son auteur"). Une édition remplace
 * intégralement le titre, la description, les tags, le barème/pénalité
 * globaux et l'ensemble des questions.
 */
export class UpdateQuizDto extends CreateQuizDto {}
