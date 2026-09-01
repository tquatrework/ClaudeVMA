import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExercisePartCategory } from '../enums/exercise-part-category.enum';
import { CreateExerciseContentItemDto } from './create-exercise-content-item.dto';
import { EXERCISE_MAX_ITEMS_PER_PART } from '../exercise.constants';

/** Solution imbriquée d'un bloc `question` — jamais autorisée sur un bloc `statement`/`image` (vérifié en service). */
export class CreateExercisePartSolutionDto {
  @ApiProperty({
    description: 'Contenu de la solution (texte/formule/image)',
    type: [CreateExerciseContentItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISE_MAX_ITEMS_PER_PART)
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseContentItemDto)
  items: CreateExerciseContentItemDto[];
}

/**
 * Bloc de la séquence ordonnée d'un exercice — 3 catégories depuis le
 * 2026-09-01 (docs/architecture.md, "Bloc 'image' de premier niveau pour
 * l'Exercice") : `statement` (énoncé, `items` texte/formule, peut être
 * vide), `image` (exactement un item de type `image` dans `items`), ou
 * `question` (`items` texte/formule non vide + `solution` obligatoire).
 *
 * `items` devient optionnel au niveau du DTO (un bloc `statement` peut être
 * vide) — les minimums par catégorie sont vérifiés côté service
 * (`ExercisesService.validatePartDto`), pas ici.
 */
export class CreateExercisePartDto {
  @ApiProperty({ enum: ExercisePartCategory, description: 'Catégorie du bloc : énoncé, image ou question' })
  @IsEnum(ExercisePartCategory)
  category: ExercisePartCategory;

  @ApiPropertyOptional({
    description:
      'Contenu du bloc. Pour "statement" : items texte/formule, facultatif (un bloc énoncé peut être vide). ' +
      'Pour "question" : items texte/formule, au moins un requis. Pour "image" : exactement un item de type "image".',
    type: [CreateExerciseContentItemDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(EXERCISE_MAX_ITEMS_PER_PART)
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseContentItemDto)
  items?: CreateExerciseContentItemDto[];

  @ApiPropertyOptional({
    description: 'Solution du bloc — obligatoire si category=question, interdite sinon',
    type: CreateExercisePartSolutionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateExercisePartSolutionDto)
  solution?: CreateExercisePartSolutionDto;
}
