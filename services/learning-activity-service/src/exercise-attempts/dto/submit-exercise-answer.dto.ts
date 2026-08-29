import { IsArray, ArrayMinSize, ValidateNested, IsString, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ExerciseContentItemDto } from './exercise-content-item.dto';

/**
 * Soumission/mise à jour de la réponse à un bloc question. Idempotent :
 * remplace la réponse précédente pour ce partId si elle existe déjà
 * (docs/architecture.md > « Refonte des Exercices », point 4 / consigne 3).
 */
export class SubmitExerciseAnswerDto {
  @ApiProperty({ description: 'Identifiant du bloc question (défini par content-catalog-service)' })
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
