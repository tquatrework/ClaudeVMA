import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationScoringMode } from '../enums/evaluation-scoring-mode.enum';

/**
 * Une entrée de barème — voir `EvaluationScoringDto` pour le contrat complet.
 * `partId` n'a de sens qu'en mode `per_question` ; sa présence en mode
 * `per_exercise` est refusée explicitement par `EvaluationsService`, jamais
 * absorbée en silence (corollaire du 2026-08-09, "aucune route ne doit
 * accepter puis ignorer un champ").
 */
export class EvaluationScoringEntryDto {
  @ApiProperty({ description: 'UUID de l\'exercice concerné (doit figurer dans exerciseItems)' })
  @IsUUID()
  exerciseId: string;

  @ApiPropertyOptional({
    description:
      'UUID du bloc question de l\'exercice (ExercisePart.id, catégorie "question") — ' +
      'obligatoire en mode per_question, absent en mode per_exercise',
  })
  @IsOptional()
  @IsUUID()
  partId?: string;

  @ApiProperty({ description: 'Valeur en points de cet item, strictement positive' })
  @IsNumber()
  @IsPositive()
  points: number;
}

export class EvaluationScoringDto {
  @ApiProperty({
    description:
      'Granularité du barème, un seul mode actif pour toute l\'évaluation',
    enum: EvaluationScoringMode,
  })
  @IsEnum(EvaluationScoringMode)
  mode: EvaluationScoringMode;

  @ApiProperty({
    description: 'Liste des entrées du barème (au moins une)',
    type: [EvaluationScoringEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoringEntryDto)
  entries: EvaluationScoringEntryDto[];
}
