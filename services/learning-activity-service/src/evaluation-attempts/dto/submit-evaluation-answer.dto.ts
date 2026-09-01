import { IsArray, ArrayMinSize, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseContentItemDto } from '../../exercise-attempts/dto/exercise-content-item.dto';

/**
 * Soumission/mise à jour de la réponse à un bloc question d'un des Exercices
 * de l'Évaluation. Réutilise ExerciseContentItemDto (même mécanisme
 * texte/formule/image que le Memo/Exercice) plutôt que d'en dupliquer un
 * second — un item de réponse est structurellement identique, que ce soit
 * pour un Exercice seul ou pour un Exercice au sein d'une Évaluation.
 * Idempotent : remplace la réponse précédente pour ce (exerciseId, partId)
 * si elle existe déjà.
 */
export class SubmitEvaluationAnswerDto {
  @ApiProperty({ description: 'Identifiant de l\'Exercice concerné (doit appartenir à l\'Évaluation)' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ description: 'Identifiant du bloc question au sein de cet Exercice' })
  @IsString()
  @IsNotEmpty()
  partId: string;

  @ApiProperty({
    description: 'Contenu de la réponse, même mécanisme texte/formule/image que le Memo',
    type: [ExerciseContentItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExerciseContentItemDto)
  content: ExerciseContentItemDto[];
}
