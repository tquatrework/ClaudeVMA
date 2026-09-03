import { CreateTutorialDto } from './create-tutorial.dto';

/**
 * Corps de PUT /tutorials/:id — même forme que POST /tutorials, sur le
 * modèle de `UpdateExerciseDto`/`UpdateQuizDto` : remplacement intégral des
 * blocs (format post) à chaque édition.
 */
export class UpdateTutorialDto extends CreateTutorialDto {}
