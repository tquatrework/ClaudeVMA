import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityStatus } from '../../common/enums/activity-status.enum';
import { ActivitySource } from '../../common/enums/activity-source.enum';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export class SearchOpenActivityDto {
  @ApiPropertyOptional({ enum: ActivityStatus, description: 'Filtrer par statut' })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({ enum: ActivitySource, description: 'Filtrer par source' })
  @IsOptional()
  @IsEnum(ActivitySource)
  source?: ActivitySource;

  @ApiPropertyOptional({ description: 'Filtrer par ID du formateur ayant publié' })
  @IsOptional()
  @IsString()
  publishedById?: string;

  @ApiPropertyOptional({ description: 'Numéro de page (commence à 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "Nombre d'éléments par page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    enum: ExportFormat,
    description: 'Format de sortie : json (défaut) ou csv',
    default: ExportFormat.JSON,
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}
