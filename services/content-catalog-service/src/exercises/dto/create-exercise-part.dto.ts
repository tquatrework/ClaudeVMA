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

/** Solution imbriquée d'un bloc `question` — jamais autorisée sur un bloc `statement` (vérifié en service). */
export class CreateExercisePartSolutionDto {
  @ApiProperty({ description: 'Contenu de la solution (texte/formule)', type: [CreateExerciseContentItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISE_MAX_ITEMS_PER_PART)
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseContentItemDto)
  items: CreateExerciseContentItemDto[];
}

export class CreateExercisePartDto {
  @ApiProperty({ enum: ExercisePartCategory, description: 'Catégorie du bloc : énoncé ou question' })
  @IsEnum(ExercisePartCategory)
  category: ExercisePartCategory;

  @ApiProperty({ description: 'Contenu du bloc (texte/formule)', type: [CreateExerciseContentItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISE_MAX_ITEMS_PER_PART)
  @ValidateNested({ each: true })
  @Type(() => CreateExerciseContentItemDto)
  items: CreateExerciseContentItemDto[];

  @ApiPropertyOptional({
    description: 'Solution du bloc — obligatoire si category=question, interdite si category=statement',
    type: CreateExercisePartSolutionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateExercisePartSolutionDto)
  solution?: CreateExercisePartSolutionDto;
}
