import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Correction soumise par le professeur (ou le RP en override d'escalade)
 * ayant accepté la demande : score et/ou commentaire — structure libre,
 * aucune comparaison à la solution officielle de l'Exercice
 * (docs/architecture.md > « Refonte des Evaluations », point 6). Au moins
 * l'un des deux champs est requis, vérifié côté service (pas de contrainte
 * de présence exclusive côté DTO, class-validator ne l'exprime pas
 * proprement pour "au moins un de deux champs optionnels").
 */
export class CorrectEvaluationDto {
  @ApiPropertyOptional({ description: 'Note attribuée à la tentative' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ description: 'Commentaire de correction' })
  @IsOptional()
  @IsString()
  comment?: string;
}
