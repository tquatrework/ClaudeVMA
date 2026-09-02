import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationScoringDto } from './evaluation-scoring.dto';

export class EvaluationExerciseItemDto {
  @ApiProperty({ description: 'UUID de l\'exercice inclus dans l\'évaluation' })
  @IsUUID()
  exerciseId: string;

  @ApiPropertyOptional({ description: 'Titre surchargé pour cet exercice dans l\'évaluation' })
  @IsOptional()
  @IsString()
  titleOverride?: string;

  @ApiProperty({ description: 'Ordre de passage de cet exercice' })
  @IsNumber()
  @Min(1)
  order: number;
}

export class CreateEvaluationDto {
  @ApiProperty({ description: 'Titre de l\'évaluation' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description courte de l\'évaluation' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Liste des exercices avec ordre et surcharge de titre', type: [EvaluationExerciseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationExerciseItemDto)
  exerciseItems: EvaluationExerciseItemDto[];

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Difficulté' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Thème mathématique' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Compétences évaluées', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competencies?: string[];

  @ApiPropertyOptional({ description: 'Tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description:
      'Durée en secondes (chronométrage), obligatoire — arbitrage du 2026-09-01 ("Refonte des ' +
      'Evaluations", point 7) : pas d\'évaluation sans limite de temps.',
  })
  @IsNumber()
  @Min(1)
  durationSeconds: number;

  @ApiPropertyOptional({ description: 'Bloquer le retour en arrière entre les exercices', default: false })
  @IsOptional()
  @IsBoolean()
  blockBackNavigation?: boolean;

  @ApiPropertyOptional({
    description:
      'Barème informatif (par exercice ou par question), affiché à l\'élève, jamais utilisé ' +
      'pour un calcul automatique — la correction reste entièrement manuelle (arbitrage du ' +
      '2026-09-02). Facultatif : une évaluation peut ne porter aucun barème.',
    type: EvaluationScoringDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EvaluationScoringDto)
  scoring?: EvaluationScoringDto;
}
