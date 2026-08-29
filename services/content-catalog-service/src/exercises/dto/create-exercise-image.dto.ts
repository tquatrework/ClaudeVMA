import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EXERCISE_ITEM_CONTENT_MAX_LENGTH } from '../exercise.constants';

/** Champs texte accompagnant l'envoi multipart d'une image (bloc ou solution). */
export class CreateExerciseImageDto {
  @ApiPropertyOptional({ description: 'Légende optionnelle de l\'image', maxLength: EXERCISE_ITEM_CONTENT_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_ITEM_CONTENT_MAX_LENGTH)
  caption?: string;
}
