import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ExerciseContentItemType } from '../entities/exercise-content-item.entity';
import { EXERCISE_ITEM_CONTENT_MAX_LENGTH } from '../exercise.constants';

/**
 * Types créables via ce DTO JSON — `image` est exclu : une image se crée via
 * une route multipart dédiée (`POST .../images`), jamais via ce DTO texte,
 * même discipline que le Mémo (`CreateMemoItemDto`).
 */
const JSON_ITEM_TYPES: Array<Exclude<ExerciseContentItemType, 'image'>> = ['text', 'formula'];

export class CreateExerciseContentItemDto {
  @ApiProperty({
    enum: ['text', 'formula'],
    description:
      "Type d'item : texte court ou formule LaTeX. Pour une image, utiliser la route multipart dédiée.",
  })
  @IsIn(JSON_ITEM_TYPES)
  type: Exclude<ExerciseContentItemType, 'image'>;

  @ApiProperty({
    description: 'Contenu : texte libre, ou formule LaTeX (ex: $\\frac{a}{b}$)',
    maxLength: EXERCISE_ITEM_CONTENT_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(EXERCISE_ITEM_CONTENT_MAX_LENGTH)
  content: string;
}
