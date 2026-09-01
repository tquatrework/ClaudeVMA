import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNotEmpty,
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
 * `solutionContent` disparaît : la solution est désormais portée
 * individuellement par chaque bloc `question` (`parts[].solution`).
 *
 * `title` redevient obligatoire le 2026-09-01 (docs/architecture.md, "Titre
 * des Exercices et des Quizz"), aligné sur `CreateQuizDto.title`. Unicité
 * par auteur vérifiée côté service (`ExercisesService.resolveUniqueTitle`) —
 * une collision ne bloque plus la création/édition depuis le 2026-09-01
 * ("disambiguation automatique plutôt que refus") : le serveur suffixe
 * automatiquement "(N)" plutôt que de renvoyer 400, jamais devinée par le
 * front — voir `GET /exercises/default-title` pour la valeur suggérée avant
 * saisie.
 *
 * Depuis le 2026-09-01 (docs/architecture.md, "Bloc 'image' de premier
 * niveau pour l'Exercice"), `parts` porte 3 catégories de bloc
 * (`statement`/`image`/`question`) au lieu de 2 : un exercice doit
 * comporter au moins un bloc `statement` (peut être vide) et au moins un
 * bloc `question` non vide (vérifié côté service,
 * `ExercisesService.validateExerciseComposition`). Une image se dépose
 * directement dans un bloc `image` dédié, encodée en base64 dans le même
 * appel — l'ancien mécanisme d'upload multipart après création est retiré.
 */
export class CreateExerciseDto {
  @ApiProperty({ description: 'Titre de l\'exercice' })
  @IsString()
  @IsNotEmpty()
  title: string;

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
