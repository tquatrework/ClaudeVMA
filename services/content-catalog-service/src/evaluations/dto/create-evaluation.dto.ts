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

  @ApiPropertyOptional({ description: 'Durée en secondes (chronométrage)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ description: 'Bloquer le retour en arrière entre les exercices', default: false })
  @IsOptional()
  @IsBoolean()
  blockBackNavigation?: boolean;
}
