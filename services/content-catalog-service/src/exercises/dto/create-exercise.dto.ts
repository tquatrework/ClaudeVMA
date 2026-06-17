import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExercisePartDto {
  @ApiProperty({ description: 'Numéro de la partie (ordre)' })
  @IsNumber()
  partNumber: number;

  @ApiProperty({ description: 'Contenu texte de la partie' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Réponse attendue (optionnelle, pour correction automatique)' })
  @IsOptional()
  @IsString()
  expectedAnswer?: string;
}

export class CreateExerciseDto {
  @ApiProperty({ description: 'Titre de l\'exercice' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description courte de l\'exercice' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Énoncé principal de l\'exercice' })
  @IsString()
  @IsNotEmpty()
  statement: string;

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

  @ApiPropertyOptional({ description: 'Coût en crédits pour demander une correction' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  correctionCost?: number;

  @ApiPropertyOptional({ description: 'Parties de l\'exercice', type: [CreateExercisePartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExercisePartDto)
  parts?: CreateExercisePartDto[];

  @ApiProperty({ description: 'Solution obligatoire pour les formateurs (texte)' })
  @IsString()
  @IsNotEmpty()
  solutionContent: string;
}
