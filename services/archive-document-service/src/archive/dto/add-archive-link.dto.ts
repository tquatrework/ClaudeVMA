import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ArchiveItemType } from '../../common/enums/archive-item-type.enum';

/**
 * DTO pour ajouter un lien archive depuis un service source.
 * Route : POST /students/:studentId/archive-links
 */
export class AddArchiveLinkDto {
  @ApiProperty({ enum: ArchiveItemType, description: 'Type de l\'élément archivé' })
  @IsEnum(ArchiveItemType)
  itemType: ArchiveItemType;

  @ApiProperty({ description: 'Identifiant de l\'entité dans le service source' })
  @IsString()
  @IsNotEmpty()
  sourceId: string;

  @ApiProperty({ description: 'Nom du service source (ex. pedagogical-log-service)' })
  @IsString()
  @IsNotEmpty()
  sourceService: string;

  @ApiProperty({ description: 'Titre court de l\'élément archivé' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description optionnelle' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL de téléchargement dans le service source' })
  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @ApiPropertyOptional({ description: 'Score pédagogique (0–20)' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ description: 'Points pédagogiques accumulés', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  pedagogicalPoints?: number;

  @ApiProperty({ description: 'Date d\'occurrence de l\'événement (ISO 8601)' })
  @IsDateString()
  occurredAt: string;

  @ApiPropertyOptional({
    description: 'Visibilité parent (false pour carnet personnel — spec XML : règle parent)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isParentVisible?: boolean;

  @ApiPropertyOptional({ description: 'Clé d\'idempotence pour commandes rejouables' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
