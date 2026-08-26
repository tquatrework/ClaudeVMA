import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsDateString,
  IsBoolean,
  IsNotEmpty,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LogVisibility } from '../entities/pedagogical-log.entity';
import { ResourceLinkDto } from './resource-link.dto';

/** Nombre maximal de liens externes par entrée — jamais un tableau non borné. */
export const MAX_RESOURCE_LINKS_PER_ENTRY = 10;

const VISIBILITY_VALUES: LogVisibility[] = [
  'eleve_parent_formateur',
  'parent_formateur',
  'formateur_rp',
  'special',
];

export class LinkedResourceDto {
  @ApiProperty({ description: 'Type de ressource (exercice, evaluation, tuto, visio…)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'UUID de la ressource' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'Libellé affiché' })
  @IsOptional()
  @IsString()
  label?: string;
}

/**
 * DTO de création d'une entrée de cahier de texte.
 *
 * Refonte du 2026-08-20 :
 * - `studentId` retiré : l'identifiant du chemin (`POST /students/:studentId/pedagogical-log`)
 *   fait seul autorité, il n'est plus jamais redemandé dans le corps (correctif du bug réel
 *   où son absence renvoyait 400).
 * - `content` (texte libre) retiré, remplacé par trois zones toutes optionnelles :
 *   `date`, `sessionSummary` (« Déroulement de la séance ») et `homework` (« À faire »).
 */
export class CreateLogDto {
  @ApiPropertyOptional({
    description:
      'Date de la séance (ISO 8601, ex. 2026-08-20). Pré-remplie à la date du jour côté front, ' +
      'reste facultative côté serveur.',
    example: '2026-08-20',
  })
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
    default: 'eleve_parent_formateur',
    description:
      "Règle de visibilité de l'entrée (PLOG-BR-006). parent_formateur : visible par le parent " +
      "et le formateur, pas l'élève (corrigé le 2026-08-20, remplace eleve_formateur).",
  })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: LogVisibility;

  @ApiPropertyOptional({
    description:
      "Masquer cette page à l'élève (pages spéciales parent/financeur). XML spec func 003.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hiddenFromStudent?: boolean;

  @ApiPropertyOptional({
    type: [LinkedResourceDto],
    description: 'Liens vers exercices, évaluations, tutos, parcours ou visios. XML spec func 002.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkedResourceDto)
  linkedResources?: Array<{ type: string; id: string; label?: string }>;

  @ApiPropertyOptional({
    type: [ResourceLinkDto],
    description:
      'Liens externes libres (label + URL absolue), distincts de linkedResources. ' +
      `Plafonné à ${MAX_RESOURCE_LINKS_PER_ENTRY} par entrée. Écriture réservée au formateur, ` +
      'même régime que sessionSummary/homework (arbitrage du 2026-08-26).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RESOURCE_LINKS_PER_ENTRY)
  @ValidateNested({ each: true })
  @Type(() => ResourceLinkDto)
  resourceLinks?: Array<{ label: string; url: string }>;

  @ApiPropertyOptional({ description: "UUID de l'activité ou séance associée" })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ description: 'UUID de la session visio associée' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ type: [String], example: ['dérivées', 'intégrales'] })
  @IsOptional()
  @IsArray()
  skillsWorked?: string[];

  @ApiPropertyOptional({ example: 'intermédiaire' })
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
