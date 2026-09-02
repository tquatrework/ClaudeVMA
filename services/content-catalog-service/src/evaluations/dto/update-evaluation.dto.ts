import { CreateEvaluationDto } from './create-evaluation.dto';

/**
 * Corps de PUT /evaluations/:id — même forme que POST /evaluations, sur le
 * modèle de `UpdateQuizDto`/`UpdateExerciseDto` (2026-08-28/2026-08-29).
 * Ajoutée le 2026-09-02 avec le barème informatif : aucune route d'édition
 * n'existait jusqu'ici pour l'Évaluation (docs/architecture.md, "Barème
 * informatif pour l'Évaluation", point ouvert signalé par front-developper).
 * Remplacement intégral (exerciseItems et scoring compris) à chaque édition.
 */
export class UpdateEvaluationDto extends CreateEvaluationDto {}
