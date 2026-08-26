import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsUUID,
  IsDateString,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LogVisibility } from '../entities/pedagogical-log.entity';
import { ResourceLinkDto } from './resource-link.dto';
import { MAX_RESOURCE_LINKS_PER_ENTRY } from './create-log.dto';

const VISIBILITY_VALUES: LogVisibility[] = [
  'eleve_parent_formateur',
  'parent_formateur',
  'formateur_rp',
  'special',
];

/**
 * DTO de modification d'une entrée de cahier de texte.
 *
 * `content` reste présent uniquement pour les pages spéciales du RP (mécanisme
 * hors périmètre de la refonte du 2026-08-20, voir PedagogicalLogService.update).
 * `date` / `sessionSummary` / `homework` sont les champs à utiliser pour éditer
 * une entrée normale.
 */
export class UpdateLogDto {
  @ApiPropertyOptional({
    description: "Contenu de la page spéciale (RP uniquement — mécanisme hors périmètre)",
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Date de la séance (ISO 8601)', example: '2026-08-20' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Déroulement de la séance' })
  @IsOptional()
  @IsString()
  sessionSummary?: string;

  @ApiPropertyOptional({ description: 'À faire' })
  @IsOptional()
  @IsString()
  homework?: string;

  @ApiPropertyOptional({
    enum: ['eleve_parent_formateur', 'parent_formateur', 'formateur_rp', 'special'],
  })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: LogVisibility;

  @ApiPropertyOptional({
    type: [ResourceLinkDto],
    description: 'Liens externes libres (label + URL absolue). Voir CreateLogDto.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RESOURCE_LINKS_PER_ENTRY)
  @ValidateNested({ each: true })
  @Type(() => ResourceLinkDto)
  resourceLinks?: Array<{ label: string; url: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  skillsWorked?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}
