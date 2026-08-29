import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExercisePartDto } from './create-exercise-part.dto';
import { EXERCISE_MAX_PARTS } from '../exercise.constants';

export { CreateExercisePartDto, CreateExercisePartSolutionDto } from './create-exercise-part.dto';
export { CreateExerciseContentItemDto } from './create-exercise-content-item.dto';

/**
 * DTO de création d'un exercice — refonte du 2026-08-29. Un exercice est une
 * séquence ordonnée de blocs (`parts`), pas un énoncé unique + parties.
 * `title` est optionnel. `solutionContent` disparaît : la solution est
 * désormais portée individuellement par chaque bloc `question`
 * (`parts[].solution`).
 */
export class CreateExerciseDto {
  @ApiPropertyOptional({ description: 'Titre de l\'exercice (optionnel)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Description courte de l\'exercice' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé (ex: seconde, terminale)' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Difficulté (ex: facile, moyen, difficile)' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Thème mathématique (ex: algèbre, géométrie)' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Compétences travaillées', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competencies?: string[];

  @ApiPropertyOptional({ description: 'Tags pour la recherche', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description:
      'Séquence ordonnée de blocs (énoncé et/ou question). Chaque bloc question porte une solution obligatoire.',
    type: [CreateExercisePartDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EXERCISE_MAX_PARTS)
  @ValidateNested({ each: true })
  @Type(() => CreateExercisePartDto)
  parts: CreateExercisePartDto[];
}
