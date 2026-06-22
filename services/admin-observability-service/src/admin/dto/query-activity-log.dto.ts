import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryActivityLogDto {
  @ApiPropertyOptional({ description: "Filtrer par rôle de l'opérateur" })
  @IsOptional()
  @IsString()
  operatorRole?: string;

  @ApiPropertyOptional({ description: "Filtrer par type de ressource" })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: "Filtrer par identifiant de ressource" })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Page (défaut: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Résultats par page (défaut: 20)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
