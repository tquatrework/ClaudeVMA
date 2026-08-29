import { CreateExerciseDto } from './create-exercise.dto';

/**
 * Corps de PUT /exercises/:id — même forme que POST /exercises, sur le
 * modèle de `UpdateQuizDto` (2026-08-28) : remplacement intégral des blocs et
 * de leurs solutions à chaque édition.
 */
export class UpdateExerciseDto extends CreateExerciseDto {}
